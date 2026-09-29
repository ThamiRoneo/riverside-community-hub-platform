import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import app from "../src/app";
import { supabaseAdmin } from "../src/config/supabase";

/**
 * Regression suite for the auth + membership surface.
 *
 * These run against the real Supabase project, because the bugs they guard
 * (trigger collision, PostgREST empty-update rejection, missing re-auth) are
 * only observable against a real database. Every test that creates a user
 * deletes it in the cleanup hook.
 */

const ADMIN = { email: "admin@riverside.example", password: "Password123" };
const TEST_PASSWORD = "Password123";

let server: Server;
let baseUrl: string;
let testUserId: string | null = null;

const uniqueEmail = () => `authtest${Date.now()}${Math.floor(Math.random() * 1e6)}@riverside.com`;

/** Narrows a seed-dependent lookup so a missing row fails loudly. */
function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${label} in the seeded database`);
  }
  return value;
}

/**
 * Creates a donation and returns a cleanup that removes it.
 *
 * campaign.current_amount is maintained by an insert-only trigger, so the
 * total has to be restored explicitly when a probe donation is removed.
 */
async function createProbeDonation(overrides: Record<string, unknown> = {}) {
  const campaign = required(
    (
      await supabaseAdmin
        .from("campaigns")
        .select("id, current_amount")
        .eq("active", true)
        .limit(1)
        .single()
    ).data,
    "an active campaign",
  );

  const { data, error } = await supabaseAdmin
    .from("donations")
    .insert({
      campaign_id: campaign.id,
      amount: 1,
      type: "one_off",
      status: "pending_followup",
      donor_name: "Probe donor",
      donor_email: "probe@riverside.example",
      anonymous: false,
      receipt_opt_in: false,
      ...overrides,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`probe donation failed: ${error?.message}`);

  return {
    donation: data,
    async cleanup() {
      await supabaseAdmin.from("donations").delete().eq("id", data.id);
      await supabaseAdmin
        .from("campaigns")
        .update({ current_amount: campaign.current_amount })
        .eq("id", campaign.id);
    },
  };
}

async function login(email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, "login should succeed");
  const body = await response.json();
  return body.session.access_token as string;
}

async function call(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (testUserId) {
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
    testUserId = null;
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("signup", () => {
  test("creates a profile without colliding with the auth trigger", async (t) => {
    const email = uniqueEmail();
    const result = await call("/api/auth/signup", {
      method: "POST",
      body: { email, password: TEST_PASSWORD, full_name: "Auth Test" },
    });

    // Supabase rate-limits outbound signup mail per project. That is an
    // environment constraint, not a regression, so do not report it as one.
    if (result.status === 400 && /rate limit/i.test(JSON.stringify(result.body))) {
      t.skip(`signup rate limited by Supabase: ${result.body.error}`);
      return;
    }

    assert.equal(
      result.status,
      201,
      `signup must not fail on a duplicate profile key: ${JSON.stringify(result.body)}`,
    );
    testUserId = result.body.user.id;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("full_name, role, membership_tier, membership_expires_at")
      .eq("id", testUserId)
      .single();

    assert.equal(error, null);
    assert.equal(data.full_name, "Auth Test");
    assert.equal(data.role, "member");
    assert.equal(data.membership_tier, "free");
    // Regression: this was 30 *hours*, not 30 days.
    const days = (Date.parse(data.membership_expires_at) - Date.now()) / 86_400_000;
    assert.ok(
      days > 29 && days < 31,
      `membership should last ~30 days, got ${days.toFixed(2)}`,
    );
  });
});

describe("PATCH /api/profile/me", () => {
  test("updates contact_phone on its own", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const phone = "+27 11 000 0005";

    const result = await call("/api/profile/me", {
      method: "PATCH",
      token,
      body: { contact_phone: phone },
    });

    // Regression: an all-undefined update was rejected by PostgREST and
    // surfaced as a misleading 404 "Profile not found".
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.contact_phone, phone);
  });

  test("rejects an empty patch with 400, not 404", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/profile/me", {
      method: "PATCH",
      token,
      body: {},
    });

    assert.equal(result.status, 400);
  });

  test("does not wipe contact_phone when only full_name is sent", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const before = await call("/api/profile/me", { token });
    const expectedPhone = before.body.contact_phone;

    const result = await call("/api/profile/me", {
      method: "PATCH",
      token,
      body: { full_name: "Riverside Admin" },
    });

    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.contact_phone, expectedPhone);
  });
});

describe("GET /api/profile/me", () => {
  test("returns the contract shape with a computed expiring_soon", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/profile/me", { token });

    assert.equal(result.status, 200);
    assert.equal(typeof result.body.expiring_soon, "boolean");
    assert.ok("contact_phone" in result.body);
    assert.ok("joined_at" in result.body);
  });
});

describe("re-authentication", () => {
  test("rejects a wrong password", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/auth/reauthenticate", {
      method: "POST",
      token,
      body: { email: ADMIN.email, password: "DefinitelyNotThePassword" },
    });

    // Regression: this returned 200 without ever checking the password.
    assert.equal(result.status, 401, JSON.stringify(result.body));
  });

  test("rejects credentials belonging to a different account", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/auth/reauthenticate", {
      method: "POST",
      token,
      body: { email: "aisha@riverside.example", password: TEST_PASSWORD },
    });

    assert.equal(result.status, 401, JSON.stringify(result.body));
  });

  test("issues a step-up token for the correct password", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/auth/reauthenticate", {
      method: "POST",
      token,
      body: { email: ADMIN.email, password: ADMIN.password },
    });

    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(typeof result.body.reauth_token, "string");
  });
});

describe("PATCH /api/members/:id/role", () => {
  const targetId = "11111111-1111-4111-8111-111111111111";

  test("is refused without a step-up token", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call(`/api/members/${targetId}/role`, {
      method: "PATCH",
      token,
      body: { role: "staff" },
    });

    assert.equal(result.status, 401, JSON.stringify(result.body));
  });

  test("is refused when the step-up token is tampered with", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const reauth = await call("/api/auth/reauthenticate", {
      method: "POST",
      token,
      body: { email: ADMIN.email, password: ADMIN.password },
    });

    const result = await call(`/api/members/${targetId}/role`, {
      method: "PATCH",
      token,
      body: { role: "staff" },
      headers: { "X-Reauth-Token": `${reauth.body.reauth_token}tampered` },
    });

    assert.equal(result.status, 401, JSON.stringify(result.body));
  });

  test("succeeds with a valid step-up token, then restores the role", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const reauth = await call("/api/auth/reauthenticate", {
      method: "POST",
      token,
      body: { email: ADMIN.email, password: ADMIN.password },
    });
    const headers = { "X-Reauth-Token": reauth.body.reauth_token as string };

    const promote = await call(`/api/members/${targetId}/role`, {
      method: "PATCH",
      token,
      body: { role: "staff" },
      headers,
    });
    assert.equal(promote.status, 200, JSON.stringify(promote.body));

    const restore = await call(`/api/members/${targetId}/role`, {
      method: "PATCH",
      token,
      body: { role: "member" },
      headers,
    });
    assert.equal(restore.status, 200, JSON.stringify(restore.body));
    assert.equal(restore.body.member.role, "member");
  });

  test("rejects the phantom 'visitor' role at the schema", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const reauth = await call("/api/auth/reauthenticate", {
      method: "POST",
      token,
      body: { email: ADMIN.email, password: ADMIN.password },
    });

    const result = await call(`/api/members/${targetId}/role`, {
      method: "PATCH",
      token,
      body: { role: "visitor" },
      headers: { "X-Reauth-Token": reauth.body.reauth_token as string },
    });

    // Regression: the DB enum rejected it behind a misleading 404.
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });
});

describe("GET /api/members", () => {
  test("applies the status filter instead of ignoring it", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const active = await call("/api/members?status=active&page_size=100", { token });
    const expired = await call("/api/members?status=expired&page_size=100", { token });

    assert.equal(active.status, 200);
    assert.equal(expired.status, 200);

    for (const member of active.body.members) {
      assert.ok(
        member.membership_expires_at === null ||
          Date.parse(member.membership_expires_at) >= Date.now(),
        `${member.full_name} should not be expired`,
      );
    }
    for (const member of expired.body.members) {
      assert.ok(
        Date.parse(member.membership_expires_at) < Date.now(),
        `${member.full_name} should have a past expiry`,
      );
    }

    // A filter that is silently dropped returns the same page for every
    // value, so the two buckets must not overlap.
    const activeIds = new Set(active.body.members.map((m: { id: string }) => m.id));
    for (const member of expired.body.members) {
      assert.ok(!activeIds.has(member.id), "active and expired must not overlap");
    }
  });

  test("rejects an unknown status value with 400", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/members?status=bogus", { token });

    // Regression: unknown filters used to be silently dropped.
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });
});

describe("GET /api/notifications", () => {
  test("returns a total and honours page_size", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/notifications?page_size=1", { token });

    assert.equal(result.status, 200);
    assert.equal(typeof result.body.total, "number");
    assert.ok(result.body.notifications.length <= 1);
  });

  test("rejects an invalid unread_only value", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/notifications?unread_only=maybe", { token });

    assert.equal(result.status, 400, JSON.stringify(result.body));
  });
});

describe("PATCH /api/bookings/:id/cancel", () => {
  const MISSING = "00000000-0000-4000-8000-000000000000";

  test("returns 404 for a booking that does not exist", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call(`/api/bookings/${MISSING}/cancel`, {
      method: "PATCH",
      token,
    });

    // Regression: the update matched zero rows but the route reported success.
    assert.equal(result.status, 404, JSON.stringify(result.body));
  });

  test("returns 403 when the booking belongs to someone else", async () => {
    const booking = required(
      (
        await supabaseAdmin
          .from("bookings")
          .select("id")
          .not("member_id", "is", null)
          .limit(1)
          .single()
      ).data,
      "at least one seeded booking",
    );


    const staffToken = await login("staff@riverside.example", "Password123");
    const result = await call(`/api/bookings/${booking.id}/cancel`, {
      method: "PATCH",
      token: staffToken,
    });

    assert.equal(result.status, 403, JSON.stringify(result.body));
  });

  test("returns the contract shape on success", async () => {
    const member = { email: "aisha@riverside.example", password: "Password123" };
    const token = await login(member.email, member.password);

    const facility = required(
      (
        await supabaseAdmin
          .from("facilities")
          .select("id")
          .eq("active", true)
          .limit(1)
          .single()
      ).data,
      "an active facility",
    );

    const start = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 91 * 86_400_000).toISOString();

    const created = await call("/api/bookings", {
      method: "POST",
      token,
      body: { facility_id: facility.id, start_at: start, end_at: end },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const bookingId = created.body.booking.id;
    const cancelled = await call(`/api/bookings/${bookingId}/cancel`, {
      method: "PATCH",
      token,
    });

    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.id, bookingId);
    assert.equal(cancelled.body.status, "cancelled");

    // Cancelling again is no longer valid and must be reported, not ignored.
    const again = await call(`/api/bookings/${bookingId}/cancel`, {
      method: "PATCH",
      token,
    });
    assert.equal(again.status, 409, JSON.stringify(again.body));
  });
});

describe("PATCH /api/donations/:id/follow-up", () => {
  test("returns 404 for a donation that does not exist", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call(
      "/api/donations/00000000-0000-4000-8000-000000000000/follow-up",
      { method: "PATCH", token, body: {} },
    );

    assert.equal(result.status, 404, JSON.stringify(result.body));
  });

  test("returns 409 for a donation that is already followed up", async () => {
    const donation = required(
      (
        await supabaseAdmin
          .from("donations")
          .select("id")
          .eq("status", "followed_up")
          .limit(1)
          .single()
      ).data,
      "at least one followed_up donation",
    );


    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call(`/api/donations/${donation.id}/follow-up`, {
      method: "PATCH",
      token,
      body: { staff_note: "should not apply" },
    });

    // Regression: the transition ran from any prior state.
    assert.equal(result.status, 409, JSON.stringify(result.body));
  });

  test("accepts a follow-up with no staff note, per the contract", async () => {
    const probe = await createProbeDonation();

    try {
      const token = await login(ADMIN.email, ADMIN.password);
      const result = await call(`/api/donations/${probe.donation.id}/follow-up`, {
        method: "PATCH",
        token,
        body: {},
      });

      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.status, "followed_up");
      assert.equal(result.body.id, probe.donation.id);
    } finally {
      await probe.cleanup();
    }
  });
});

describe("GET /api/donations/export.csv", () => {
  test("neutralises spreadsheet formulas in donor-supplied fields", async () => {
    const payload = `=SUM(1+1)-${Date.now()}`;
    const probe = await createProbeDonation({ donor_name: payload });

    try {
      const token = await login(ADMIN.email, ADMIN.password);
      const response = await fetch(`${baseUrl}/api/donations/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      const csv = await response.text();

      assert.ok(
        csv.includes(`"'${payload}"`),
        "a leading '=' must be prefixed so Excel treats it as text",
      );
      assert.ok(
        !csv.includes(`"${payload}"`),
        "the raw formula must not reach the export unescaped",
      );
    } finally {
      await probe.cleanup();
    }
  });

  test("redacts the identity of anonymous donations", async () => {
    const marker = `anon-probe-${Date.now()}`;
    const probe = await createProbeDonation({
      donor_name: marker,
      donor_email: `${marker}@riverside.example`,
      donor_phone: "+27 00 000 0000",
      anonymous: true,
    });

    try {
      const token = await login(ADMIN.email, ADMIN.password);
      const csv = await (
        await fetch(`${baseUrl}/api/donations/export.csv`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).text();

      assert.ok(
        !csv.includes(marker),
        "an anonymous donor's name and email must not be exported",
      );
    } finally {
      await probe.cleanup();
    }
  });
});

describe("DELETE /api/campaigns/:id", () => {
  test("returns 409 when the campaign still has donations", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call(
      "/api/campaigns/81111111-1111-4111-8111-111111111111",
      { method: "DELETE", token },
    );

    // Regression: the FK violation surfaced as a generic 500.
    assert.equal(result.status, 409, JSON.stringify(result.body));
  });
});
