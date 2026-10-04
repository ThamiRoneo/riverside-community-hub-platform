import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPatch, apiPost, reauthenticate } from "../lib/api";
import type { StaffRecord, StaffRole } from "../types";

/**
 * Admin-only staff accounts: list, invite, deactivate.
 *
 * Both writes are gated behind re-authentication on the server, so submitting
 * either one only stages it and a single password prompt confirms. Asking for a
 * password twice would be worse for no gain, and this matches how the member
 * role change already works in AdminDashboard.
 */
type PendingAction =
  | { kind: "invite" }
  | { kind: "deactivate"; id: string; name: string };

export default function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("staff");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await apiGet<{ staff: StaffRecord[] }>("/staff");
      setStaff(response.staff);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function stageInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending({ kind: "invite" });
    setPassword("");
  }

  function stageDeactivate(staffMember: StaffRecord) {
    setMessage("");
    setPending({
      kind: "deactivate",
      id: staffMember.id,
      name: staffMember.full_name,
    });
    setPassword("");
  }

  function cancel() {
    setPending(null);
    setPassword("");
    setMessage("");
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await reauthenticate(password);
      if (pending.kind === "invite") {
        await apiPost(
          "/staff/invite",
          { email, role: inviteRole },
          { "X-Reauth-Token": token },
        );
        setMessage(`Invite sent to ${email}. They join as ${inviteRole}.`);
        setEmail("");
      } else {
        await apiPatch(
          `/staff/${pending.id}/deactivate`,
          {},
          { "X-Reauth-Token": token },
        );
        setMessage(
          `${pending.name} can no longer sign in. Their history is kept.`,
        );
      }
      setPending(null);
      setPassword("");
      await load();
    } catch (error) {
      // The server is the only place that knows whether this was the last
      // active admin, so its message is what the admin gets.
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "error") {
    return (
      <p role="alert">
        Unable to load staff accounts. Refresh to try again.
      </p>
    );
  }

  return (
    <section aria-labelledby="staff-management-heading" style={sectionStyle}>
      <h3 id="staff-management-heading">Staff accounts</h3>

      <form onSubmit={stageInvite} style={formStyle}>
        <label htmlFor="staff-invite-email">
          Invite a colleague
        </label>
        <div style={rowStyle}>
          <input
            id="staff-invite-email"
            type="email"
            required
            autoComplete="off"
            placeholder="colleague@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            aria-label="Role for the invited colleague"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as StaffRole)}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit">Send invite</button>
        </div>
      </form>

      {status === "loading" ? (
        <p role="status">Loading staff accounts...</p>
      ) : staff.length === 0 ? (
        <p role="status">No staff accounts yet.</p>
      ) : (
        <ul style={listStyle} role="list">
          {staff.map((staffMember) => (
            <li key={staffMember.id} style={itemStyle}>
              <div>
                <strong>{staffMember.full_name}</strong>
                <p style={metaStyle}>
                  {staffMember.role === "admin" ? "Admin" : "Staff"} · joined{" "}
                  {new Date(staffMember.joined_at).toLocaleDateString()}
                </p>
                {/* Deactivation is stated in words as well as colour. */}
                {!staffMember.active ? (
                  <p style={inactiveStyle}>Deactivated</p>
                ) : null}
              </div>
              {staffMember.active ? (
                <button
                  type="button"
                  // Deactivating yourself would end the session you are using,
                  // so the server refuses it. Saying so here saves a round trip.
                  disabled={staffMember.id === user?.id}
                  title={
                    staffMember.id === user?.id
                      ? "You cannot deactivate your own account"
                      : undefined
                  }
                  onClick={() => stageDeactivate(staffMember)}
                >
                  Deactivate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <form onSubmit={confirm} style={formStyle}>
          <label htmlFor="staff-reauth-password">
            {pending.kind === "invite"
              ? `Confirm the invite to ${email}`
              : `Confirm deactivating ${pending.name}`}
          </label>
          <div style={rowStyle}>
            <input
              id="staff-reauth-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" disabled={busy}>
              {busy ? "Confirming..." : "Confirm"}
            </button>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

const sectionStyle = { marginBottom: "1.5rem" };

const formStyle = {
  display: "grid",
  gap: "0.5rem",
  marginBottom: "1rem",
};

const rowStyle = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap" as const,
};

const listStyle = {
  listStyle: "none",
  margin: "0 0 1rem",
  padding: 0,
};

const itemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  padding: "0.6rem 0",
  borderBottom: "1px solid #e2e8f0",
};

const metaStyle = {
  margin: "0.15rem 0 0",
  fontSize: "0.875rem",
  color: "#64748b",
};

const inactiveStyle = {
  margin: "0.15rem 0 0",
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "#b91c1c",
};