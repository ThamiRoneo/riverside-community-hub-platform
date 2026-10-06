import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthContext";

/**
 * This file exists because the context had none, and the loop it was missing
 * could not be caught by testing the components that consume it: the consumers
 * mock the api module, so nothing was ever watching how many times the provider
 * asked for the profile.
 */

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  reauthenticate: vi.fn(),
}));

const getSession = vi.fn();
const setSession = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      setSession: (...args: unknown[]) => setSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...(args as [])),
    },
  },
}));

const profile = {
  id: "u-1",
  full_name: "Aisha Khan",
  contact_phone: "07123456789",
  role: "member" as const,
  membership_tier: "free",
  membership_expires_at: null,
  joined_at: "2026-09-23T11:20:06.159Z",
  created_at: "2026-09-23T11:20:06.159Z",
  expiring_soon: false,
};

/** Renders the context and reports what the consumer can see. */
function Probe() {
  const { user, login } = useAuth();
  return (
    <div>
      <span data-testid="name">{user?.fullName ?? "none"}</span>
      <button type="button" onClick={() => void login("a@b.com", "pw")}>
        sign in
      </button>
    </div>
  );
}

function renderContext() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getSession.mockResolvedValue({ data: { session: null } });
  apiGet.mockResolvedValue(profile);
  apiPost.mockResolvedValue({
    session: { access_token: "tok", refresh_token: "ref" },
    user: { id: "u-1", email: "aisha@riverside.example", role: "member" },
  });
  setSession.mockResolvedValue({ error: null });
});

afterEach(() => localStorage.clear());

describe("AuthContext profile refresh", () => {
  it("asks for the profile once after signing in, not once a second", async () => {
    renderContext();

    await act(async () => {
      screen.getByRole("button", { name: /sign in/i }).click();
    });

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();

    // The regression: keying the effect on the user object while that effect set
    // a new object made this fire forever, roughly once per Supabase round trip.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const profileCalls = apiGet.mock.calls.filter(
      (call) => call[0] === "/profile/me",
    );
    expect(profileCalls).toHaveLength(1);
  });

  it("updates the displayed name when the profile differs", async () => {
    // Stale name from the saved session, fresh name from the server.
    localStorage.setItem(
      "riverside-auth-user",
      JSON.stringify({ id: "u-1", email: "a@x.com", fullName: "Old Name", role: "member" }),
    );

    renderContext();

    // The saved session is read synchronously on mount, then the provider
    // restores from Supabase, which reports no session here.
    await waitFor(() => {
      expect(screen.getByText("Old Name")).toBeInTheDocument();
    });
    expect(screen.getByText("Aisha Khan")).toBeInTheDocument();
  });

  it("keeps the signed-in name and logs a failed profile fetch", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    apiGet.mockRejectedValue(new Error("network down"));

    renderContext();

    await act(async () => {
      screen.getByRole("button", { name: /sign in/i }).click();
    });

    // A failure must not clear the session or spin. The console.error is the
    // only signal that the name is stale, so it has to be there.
    await waitFor(() => {
      expect(errors).toHaveBeenCalledWith(
        "Failed to fetch profile",
        expect.any(Error),
      );
    });

    const profileCalls = apiGet.mock.calls.filter(
      (call) => call[0] === "/profile/me",
    );
    expect(profileCalls).toHaveLength(1);
    errors.mockRestore();
  });
});