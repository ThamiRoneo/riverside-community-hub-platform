import { type FormEvent, useState } from "react";

import { apiPatch, reauthenticate } from "../lib/api";
import type { MemberRecord, Role } from "../types";

interface MemberListProps {
  members: MemberRecord[];
  onUpdateMembers: (members: MemberRecord[]) => void;
  onActionMessage: (message: string) => void;
}

export default function MemberList({ members, onUpdateMembers, onActionMessage }: MemberListProps) {
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewalTier, setRenewalTier] = useState("");
  const [renewalDays, setRenewalDays] = useState("90");
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    memberId: string;
    role: Role;
  } | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [roleChangeBusy, setRoleChangeBusy] = useState(false);

  async function updateMemberRole(id: string, role: Role) {
    const token = await reauthenticate(reauthPassword);
    await apiPatch(`/members/${id}/role`, { role }, { "X-Reauth-Token": token });
    onUpdateMembers(members.map((member) => (member.id === id ? { ...member, role } : member)));
    setPendingRoleChange(null);
    setReauthPassword("");
    onActionMessage("Member role updated.");
  }

  function stageRoleChange(id: string, role: Role) {
    onActionMessage("");
    setPendingRoleChange({ memberId: id, role });
    setReauthPassword("");
  }

  function cancelRoleChange() {
    setPendingRoleChange(null);
    setReauthPassword("");
  }

  async function confirmRoleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRoleChange) return;

    if (!reauthPassword) {
      onActionMessage("Enter your password to confirm the role change.");
      return;
    }

    setRoleChangeBusy(true);
    onActionMessage("");
    try {
      await updateMemberRole(pendingRoleChange.memberId, pendingRoleChange.role);
    } catch (error) {
      onActionMessage(
        error instanceof Error ? error.message : "Unable to update member role",
      );
    } finally {
      setRoleChangeBusy(false);
    }
  }

  function startRenewal(member: MemberRecord) {
    onActionMessage("");
    setRenewingId(member.id);
    setRenewalTier(member.membership_tier ?? "free");
    setRenewalDays("90");
  }

  function cancelRenewal() {
    setRenewingId(null);
    setRenewalTier("");
  }

  async function renewMembership(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const tier = renewalTier.trim();
    if (!tier) {
      onActionMessage("A membership tier is required.");
      return;
    }

    const expiresAt = new Date(
      Date.now() + Number(renewalDays) * 86_400_000,
    ).toISOString();

    try {
      const response = await apiPatch<{ member: MemberRecord }>(
        `/members/${id}/tier`,
        { membership_tier: tier, membership_expires_at: expiresAt },
      );
      onUpdateMembers(members.map((member) =>
        member.id === id ? { ...member, ...response.member } : member,
      ));
      onActionMessage(`Membership renewed to ${tier} for ${renewalDays} days.`);
      cancelRenewal();
    } catch (error) {
      onActionMessage(
        error instanceof Error ? error.message : "Unable to renew membership",
      );
    }
  }

  return (
    <>
      <h3>Recent members</h3>
      <p>
        Members join by signing up themselves. Staff and admin accounts are
        created from the Staff page.
      </p>
      {members.length === 0 ? <p>No members found.</p> : null}
      <ul>
        {members.map((member) => (
          <li key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
            <div>
              {member.full_name} ({member.role})
              {member.membership_expires_at ? (
                <><br /><small>
                  Expires: {new Date(member.membership_expires_at).toLocaleDateString()}
                </small></>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={
                  pendingRoleChange?.memberId === member.id
                    ? pendingRoleChange.role
                    : member.role
                }
                onChange={(event) =>
                  stageRoleChange(
                    member.id,
                    event.target.value as MemberRecord["role"],
                  )
                }
              >
                <option value="member">Member</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="button"
                onClick={() => startRenewal(member)}
                aria-expanded={renewingId === member.id}
                style={{
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Renew
                {member.full_name}
              </button>
            </div>
            {renewingId === member.id ? (
              <form
                onSubmit={(event) => renewMembership(event, member.id)}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "flex-end",
                  marginTop: "0.5rem",
                  width: "100%",
                }}
              >
                <label style={{ display: "grid", gap: "0.2rem" }}>
                  Membership tier
                  <input
                    required
                    value={renewalTier}
                    onChange={(event) => setRenewalTier(event.target.value)}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.2rem" }}>
                  Term
                  <select
                    value={renewalDays}
                    onChange={(event) => setRenewalDays(event.target.value)}
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                  </select>
                </label>
                <button type="submit">Save renewal</button>
                <button type="button" onClick={cancelRenewal}>
                  Cancel
                </button>
              </form>
            ) : null}
            {pendingRoleChange?.memberId === member.id ? (
              <form
                onSubmit={confirmRoleChange}
                style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
              >
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Confirm with your password"
                  aria-label={`Confirm role change for ${member.full_name}`}
                  value={reauthPassword}
                  onChange={(event) => setReauthPassword(event.target.value)}
                />
                <button type="submit" disabled={roleChangeBusy}>
                  {roleChangeBusy ? "Confirming..." : "Confirm"}
                </button>
                <button type="button" onClick={cancelRoleChange}>
                  Cancel
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
