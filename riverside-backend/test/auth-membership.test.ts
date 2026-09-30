/*  */import assert from "node:assert/strict";
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

/** Removes a booking plus the notifications the API created for it. */
async function removeProbeBooking(bookingId: string) {
  await supabaseAdmin.from("notifications").delete().eq("booking_id", bookingId);
  await supabaseAdmin.from("bookings").delete().eq("id", bookingId);
}

/**
 * Creates a donation and returns a cleanup that removes it.
 *
 * apply_donation_to_campaign adds the amount on insert and subtracts it on
 * delete, so removing the probe is enough to restore the campaign total. Writing
 * the total back from a snapshot instead would stomp on any legitimate change
 * made while the probe was alive.
 */
async function createProbeDonation(overrides: Record<string, unknown> = {}) {
  const campaign = required(
    (
      await supabaseAdmin
        .from("campaigns")
        .select("id")
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
    },
  };
}

/**
 * Tokens are cached per account for the length of a run.
 *
 * The suite signs in around forty times, which is enough to trip Supabase's
 * sign-in rate limit and turn unrelated tests red with a spurious 401. Role is
 * read from the database on every request rather than from the token, so a
 * cached token still reflects a role change made by an earlier test.
 */
const sessionTokens = new Map<string, Promise<string>>();

async function login(email: string, password: string) {
  const cached = sessionTokens.get(email);
  if (cached) return cached;

  const attempt = (async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(
      response.status,
      200,
      `login should succeed for ${email}, got ${response.status}`,
    );
    const body = await response.json();
    return body.session.access_token as string;
  })();

  sessionTokens.set(email, attempt);
  return attempt;
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

    await removeProbeBooking(bookingId);
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
    // Provisioned here rather than read from the seed, so the check does not
    // depend on a fixture row existing in whatever state the seed last left.
    const probe = await createProbeDonation({ status: "followed_up" });

    try {
      const token = await login(ADMIN.email, ADMIN.password);
      const result = await call(`/api/donations/${probe.donation.id}/follow-up`, {
        method: "PATCH",
        token,
        body: { staff_note: "should not apply" },
      });

      // Regression: the transition ran from any prior state.
      assert.equal(result.status, 409, JSON.stringify(result.body));
    } finally {
      await probe.cleanup();
    }
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

describe("GET /api/donations/export", () => {
  test("neutralises spreadsheet formulas in donor-supplied fields", async () => {
    const payload = `=SUM(1+1)-${Date.now()}`;
    const probe = await createProbeDonation({ donor_name: payload });

    try {
      const token = await login(ADMIN.email, ADMIN.password);
      const response = await fetch(`${baseUrl}/api/donations/export`, {
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
        await fetch(`${baseUrl}/api/donations/export`, {
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

describe("POST /api/donations", () => {
  test("a one_off donation settles as paid and returns a receipt reference", async () => {
    const campaign = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("active", true)
          .limit(1)
          .single()
      ).data,
      "an active campaign",
    );

    const result = await call("/api/donations", {
      method: "POST",
      body: {
        campaign_id: campaign.id,
        amount: 42,
        type: "one_off",
        donor_name: "One off donor",
        donor_email: "oneoff@riverside.example",
        anonymous: false,
        receipt_opt_in: true,
      },
    });

    try {
      assert.equal(result.status, 201, JSON.stringify(result.body));
      // Contract response shape: {id, status, receipt_reference}
      assert.equal(result.body.status, "paid");
      assert.equal(typeof result.body.id, "string");
      assert.match(result.body.receipt_reference, /^RCH-\d{4}-[0-9A-F]{8}$/);

      const stored = required(
        (
          await supabaseAdmin
            .from("donations")
            .select("type, status, receipt_reference")
            .eq("id", result.body.id)
            .single()
        ).data,
        "the stored donation",
      );

      // Regression: every donation previously defaulted to pending_followup.
      assert.equal(stored.type, "one_off");
      assert.equal(stored.status, "paid");
      assert.equal(stored.receipt_reference, result.body.receipt_reference);
    } finally {
      // The trigger subtracts on delete, so the total needs no manual restore.
      await supabaseAdmin.from("donations").delete().eq("id", result.body.id);
    }
  });

  test("a pledge_intent donation is queued as pending_followup", async () => {
    const campaign = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("active", true)
          .limit(1)
          .single()
      ).data,
      "an active campaign",
    );

    const result = await call("/api/donations", {
      method: "POST",
      body: {
        campaign_id: campaign.id,
        amount: 77,
        type: "pledge_intent",
        donor_name: "Pledger",
        donor_email: "pledger@riverside.example",
        anonymous: false,
        receipt_opt_in: false,
      },
    });

    try {
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.equal(result.body.status, "pending_followup");
    } finally {
      await supabaseAdmin.from("donations").delete().eq("id", result.body.id);
    }
  });

  test("rejects the removed 'monthly' type", async () => {
    const campaign = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("active", true)
          .limit(1)
          .single()
      ).data,
      "an active campaign",
    );

    const result = await call("/api/donations", {
      method: "POST",
      body: {
        campaign_id: campaign.id,
        amount: 10,
        type: "monthly",
        donor_name: "Old client",
        anonymous: false,
        receipt_opt_in: false,
      },
    });

    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  test("returns 404 for a donation against a non-existent campaign", async () => {
    const result = await call("/api/donations", {
      method: "POST",
      body: {
        campaign_id: "00000000-0000-4000-8000-000000000000",
        amount: 10,
        type: "one_off",
        donor_name: "Nowhere",
        anonymous: false,
        receipt_opt_in: false,
      },
    });

    // Regression: the FK violation surfaced as a generic 500.
    assert.equal(result.status, 404, JSON.stringify(result.body));
  });
});

describe("campaign.current_amount integrity", () => {
  test("deleting a donation decrements the campaign total", async () => {
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

    const before = campaign.current_amount;
    const probe = await createProbeDonation({ amount: 123 });

    const afterInsert = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("current_amount")
          .eq("id", campaign.id)
          .single()
      ).data,
      "the campaign after insert",
    );

    await probe.cleanup();

    const afterDelete = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("current_amount")
          .eq("id", campaign.id)
          .single()
      ).data,
      "the campaign after delete",
    );

    assert.equal(
      Number(afterInsert.current_amount),
      Number(before) + 123,
      "an insert must raise the total",
    );
    // Regression: the trigger was insert-only, so a delete left the total
    // permanently inflated.
    assert.equal(
      Number(afterDelete.current_amount),
      Number(before),
      "a delete must lower the total back",
    );
  });

  test("a cancelled donation is withdrawn and never counted", async () => {
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

    const before = campaign.current_amount;
    const probe = await createProbeDonation({ amount: 500, status: "paid" });

    const afterPaid = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("current_amount")
          .eq("id", campaign.id)
          .single()
      ).data,
      "the campaign while the donation counted",
    );

    assert.equal(
      Number(afterPaid.current_amount),
      Number(before) + 500,
      "a paid donation must raise the total",
    );

    await supabaseAdmin
      .from("donations")
      .update({ status: "cancelled" })
      .eq("id", probe.donation.id);

    const afterCancel = required(
      (
        await supabaseAdmin
          .from("campaigns")
          .select("current_amount")
          .eq("id", campaign.id)
          .single()
      ).data,
      "the campaign after the donation was cancelled",
    );

    try {
      // Regression: the trigger added the amount on every insert regardless of
      // status, so a cancelled donation inflated the public progress bar for good.
      assert.equal(
        Number(afterCancel.current_amount),
        Number(before),
        "cancelling must take the amount back out",
      );
    } finally {
      await probe.cleanup();
    }
  });

  test("the live total equals the sum of the campaign's non-cancelled donations", async () => {
    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, current_amount");

    for (const campaign of campaigns ?? []) {
      const { data: donations } = await supabaseAdmin
        .from("donations")
        .select("amount, status")
        .eq("campaign_id", campaign.id)
        .neq("status", "cancelled");

      const expected = (donations ?? []).reduce(
        (total, d) => total + Number(d.amount),
        0,
      );

      assert.equal(
        Number(campaign.current_amount),
        expected,
        `${campaign.title} total must equal the sum of its non-cancelled donations`,
      );
    }
  });
});

describe("GET /api/reports/summary", () => {
  const STAFF = { email: "staff@riverside.example", password: "Password123" };

  test("returns every field the contract documents", async () => {
    const token = await login(STAFF.email, STAFF.password);
    const result = await call("/api/reports/summary", { token });

    assert.equal(result.status, 200, JSON.stringify(result.body));
    for (const field of [
      "bookings_this_month",
      "bookings_delta_pct",
      "donations_total",
      "donations_delta_pct",
      "active_members",
      "active_members_delta",
      "pending_requests",
      "conflict_count",
    ]) {
      assert.equal(
        typeof result.body[field],
        "number",
        `${field} must be a number, got ${typeof result.body[field]}`,
      );
    }
    assert.ok(Array.isArray(result.body.bookings_by_status), "bookings_by_status must be a list");
    assert.ok(Array.isArray(result.body.donations_over_time), "donations_over_time must be a list");
    assert.deepStrictEqual(
      result.body.bookings_by_status.map((b: { status: string }) => b.status),
      ["pending", "approved", "rejected", "cancelled"],
      "every booking status must be represented, including the empty ones",
    );
  });

  test("rejects a date_range it does not recognise", async () => {
    const token = await login(STAFF.email, STAFF.password);

    const range = await call("/api/reports/summary?date_range=fortnight", { token });
    assert.equal(range.status, 400, JSON.stringify(range.body));

    const compare = await call("/api/reports/summary?compare_with=fortnight", { token });
    assert.equal(compare.status, 400, JSON.stringify(compare.body));

    const valid = await call("/api/reports/summary?date_range=week&compare_with=month", { token });
    assert.equal(valid.status, 200, JSON.stringify(valid.body));
  });

  test("counts bookings that overlap another live booking on the same resource", async () => {
    const token = await login(STAFF.email, STAFF.password);
    const facility = required(
      (
        await supabaseAdmin.from("facilities").select("id").eq("active", true).limit(1).single()
      ).data,
      "an active facility",
    );

    const summary = async () => {
      const result = await call("/api/reports/summary", { token });
      return required(result.body, "a summary");
    };

    const before = await summary();

    // A window well clear of the seeded bookings, so the only overlap on this
    // facility is the pair created here. Pending bookings may overlap: the
    // database only refuses two overlapping *approved* ones.
    const start = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 60 * 86_400_000 + 7_200_000).toISOString();
    const later = new Date(Date.now() + 60 * 86_400_000 + 3_600_000).toISOString();
    const overlapping = await supabaseAdmin
      .from("bookings")
      .insert([
        { member_id: "11111111-1111-4111-8111-111111111111", facility_id: facility.id, equipment_id: null, start_at: start, end_at: end, status: "pending" },
        { member_id: "22222222-2222-4222-8222-222222222222", facility_id: facility.id, equipment_id: null, start_at: later, end_at: end, status: "pending" },
      ])
      .select("id");

    try {
      assert.equal(overlapping.error, null, overlapping.error?.message);
      const after = await summary();
      assert.equal(
        after.conflict_count,
        before.conflict_count + 2,
        "both members of an overlapping pair must be counted as conflicting",
      );
    } finally {
      await supabaseAdmin.from("bookings").delete().in("id", (overlapping.data ?? []).map((b) => b.id));
    }

    const restored = await summary();
    assert.equal(
      restored.conflict_count,
      before.conflict_count,
      "removing the pair must leave no conflict behind",
    );
  });

  test("leaves cancelled donations out of donations_total", async () => {
    const token = await login(STAFF.email, STAFF.password);
    const before = required((await call("/api/reports/summary", { token })).body, "a summary");

    const probe = await createProbeDonation({ amount: 999, status: "cancelled" });

    try {
      const after = required((await call("/api/reports/summary", { token })).body, "a summary");
      assert.equal(
        after.donations_total,
        before.donations_total,
        "a cancelled donation is withdrawn money and must not be counted",
      );
    } finally {
      await probe.cleanup();
    }
  });
});

describe("GET /api/reports/export", () => {
  const ADMIN = { email: "admin@riverside.example", password: "Password123" };
  const STAFF = { email: "staff@riverside.example", password: "Password123" };

  const download = async (token: string, query = "") => {
    const response = await fetch(`${baseUrl}/api/reports/export${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: response.status, text: () => response.text(), response };
  };

  test("is admin-only; staff are refused", async () => {
    const staffToken = await login(STAFF.email, STAFF.password);
    const result = await call("/api/reports/export", { token: staffToken });

    // Regression: the summary is open to staff, but the CSV is admin-only.
    assert.equal(result.status, 403, JSON.stringify(result.body));
  });

  test("streams a CSV of the window's rows, not the summary figures", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const { status, text, response } = await download(token);

    assert.equal(status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /attachment; filename=report-month-/,
    );

    const csv = await text();
    const [header, ...rows] = csv.split("\n");
    assert.equal(
      header,
      "record_type,id,created_at,status,person_id,resource,start_at,end_at,amount,type,receipt_reference,staff_note",
    );
    assert.ok(rows.length > 0, "the seeded window must produce rows");
    assert.ok(
      rows.some((row) => row.startsWith('"booking",')),
      "bookings must appear in the export",
    );
    assert.ok(
      rows.some((row) => row.startsWith('"donation",')),
      "donations must appear in the export",
    );
    // Chronological, so the file reads as an activity report.
    const created = rows.map((row) => /"([^"]*)"/.exec(row.split(",").slice(2).join(","))?.[1] ?? "");
    assert.ok(created.every(Boolean), "every row must carry a created_at");
    assert.deepStrictEqual(created, [...created].sort(), "rows must be in date order");
  });

  test("excludes cancelled donations and anonymises anonymous donors", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const probe = await createProbeDonation({
      amount: 4321,
      status: "cancelled",
      donor_name: "Cancelled probe",
    });
    const anonymous = await createProbeDonation({
      amount: 21,
      status: "paid",
      anonymous: true,
      donor_name: "anon-probe-export",
      donor_email: "anon-probe-export@riverside.example",
    });

    try {
    const csv = await (await download(token)).text();

    assert.ok(!csv.includes("Cancelled probe"), "a cancelled donation must be excluded");
    assert.ok(
      !csv.includes("anon-probe-export"),
      "an anonymous donor's contact details must not be exported",
    );
    assert.ok(
      csv.includes(anonymous.donation.id),
      "a paid donation is still exported",
    );
    // The same row must not carry the donor's profile id, which would point
    // straight back at their profile.
    const anonymousRow = csv.split("\n").find((line) => line.includes(anonymous.donation.id));
    assert.ok(anonymousRow, "the anonymous donation row must be present");
    const personColumn = anonymousRow.split(",")[4].replace(/"/g, "");
    assert.equal(personColumn, "", "an anonymous donor's profile id must be blank");
    } finally {
      await probe.cleanup();
      await anonymous.cleanup();
    }
  });

  test("honours the date_range filter", async () => {
    const token = await login(ADMIN.email, ADMIN.password);

    const bad = await call("/api/reports/export?date_range=fortnight", { token });
    assert.equal(bad.status, 400, JSON.stringify(bad.body));

    // Seeded rows all fall inside the last week, so a week and a year would look
    // identical. This probe is stamped two months back, which only the wider
    // ranges may include.
    const old = await createProbeDonation({
      amount: 777,
      status: "paid",
      created_at: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    });

    try {
      const week = await (await download(token, "?date_range=week")).text();
      const month = await (await download(token, "?date_range=month")).text();
      const year = await (await download(token, "?date_range=year")).text();

      assert.ok(!week.includes(old.donation.id), "a two-month-old row is outside a week");
      assert.ok(!month.includes(old.donation.id), "a two-month-old row is outside this month");
      assert.ok(year.includes(old.donation.id), "a two-month-old row is inside a year");
    } finally {
      await old.cleanup();
    }
  });
});

describe("access control: contract role matrix", () => {
  const STAFF = { email: "staff@riverside.example", password: "Password123" };
  const MEMBER = { email: "aisha@riverside.example", password: "Password123" };

  test("donation export is admin-only; staff are refused", async () => {
    const staffToken = await login(STAFF.email, STAFF.password);
    const denied = await call("/api/donations/export", { token: staffToken });

    // Regression: the export was reachable by staff, exposing donor contact
    // details, while the contract grants it to admins only.
    assert.equal(denied.status, 403, JSON.stringify(denied.body));

    const adminToken = await login(ADMIN.email, ADMIN.password);
    // The export returns text/csv, so check it without the JSON helper.
    const allowed = await fetch(`${baseUrl}/api/donations/export`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get("content-type") ?? "", /text\/csv/);
  });

  test("the removed /export.csv path is gone", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const result = await call("/api/donations/export.csv", { token });

    assert.equal(result.status, 404, JSON.stringify(result.body));
  });

  test("reports summary is reachable by staff, not only admins", async () => {
    const staffToken = await login(STAFF.email, STAFF.password);
    const staff = await call("/api/reports/summary", { token: staffToken });

    // Regression: this was admin-only, locking staff out of the summary.
    assert.equal(staff.status, 200, JSON.stringify(staff.body));

    const memberToken = await login(MEMBER.email, MEMBER.password);
    const member = await call("/api/reports/summary", { token: memberToken });
    assert.equal(member.status, 403, JSON.stringify(member.body));
  });

  test("only an admin may delete a facility or equipment", async () => {
    const staffToken = await login(STAFF.email, STAFF.password);

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
    const equipment = required(
      (
        await supabaseAdmin
          .from("equipment")
          .select("id")
          .eq("active", true)
          .limit(1)
          .single()
      ).data,
      "active equipment",
    );

    // Regression: staff could deactivate resources, removing them from
    // public booking. The contract makes deletion admin-only.
    const deniedFacility = await call(`/api/facilities/${facility.id}`, {
      method: "DELETE",
      token: staffToken,
    });
    assert.equal(deniedFacility.status, 403, JSON.stringify(deniedFacility.body));

    const deniedEquipment = await call(`/api/equipment/${equipment.id}`, {
      method: "DELETE",
      token: staffToken,
    });
    assert.equal(deniedEquipment.status, 403, JSON.stringify(deniedEquipment.body));

    // Confirm nothing was actually deactivated by the refused calls.
    const stillActive = required(
      (
        await supabaseAdmin
          .from("facilities")
          .select("active")
          .eq("id", facility.id)
          .single()
      ).data,
      "the facility row",
    );
    assert.equal(stillActive.active, true);
  });

  test("staff may create and edit programmes; only an admin may delete them", async () => {
    const staffToken = await login(STAFF.email, STAFF.password);
    const suffix = Date.now();

    const created = await call("/api/programmes", {
      method: "POST",
      token: staffToken,
      body: {
        title: `Staff programme ${suffix}`,
        description: "Created by staff",
        age_range: "5-12",
        schedule_info: "Mon 16:00",
        active: true,
      },
    });

    // Regression: programme creation was admin-only, but the contract
    // grants it to staff and admins alike.
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const programmeId = created.body.programme.id;

    try {

      const updated = await call(`/api/programmes/${programmeId}`, {
        method: "PATCH",
        token: staffToken,
        body: { title: `Staff programme ${suffix} edited` },
      });
      assert.equal(updated.status, 200, JSON.stringify(updated.body));

      const staffDelete = await call(`/api/programmes/${programmeId}`, {
        method: "DELETE",
        token: staffToken,
      });
      assert.equal(staffDelete.status, 403, JSON.stringify(staffDelete.body));
    } finally {
      // Delete by id: the update above renames the programme, so matching on
      // the original title would no longer find it.
      await supabaseAdmin.from("programmes").delete().eq("id", programmeId);
    }
  });

  test("only a member may create a booking", async () => {
    const start = new Date(Date.now() + 150 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 151 * 86_400_000).toISOString();
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

    const body = { facility_id: facility.id, start_at: start, end_at: end };

    // Regression: any authenticated user, including staff, could create a
    // booking attributed to their own profile.
    const staffToken = await login(STAFF.email, STAFF.password);
    const staff = await call("/api/bookings", {
      method: "POST",
      token: staffToken,
      body,
    });
    assert.equal(staff.status, 403, JSON.stringify(staff.body));

    const memberToken = await login(MEMBER.email, MEMBER.password);
    const member = await call("/api/bookings", {
      method: "POST",
      token: memberToken,
      body,
    });
    assert.equal(member.status, 201, JSON.stringify(member.body));

    await removeProbeBooking(member.body.booking.id);
  });
});
