import { useEffect, useState, type FormEvent } from "react";
import CampaignManagement from "../components/CampaignManagement";
import ProgrammeManagement from "../components/ProgrammeManagement";
import StaffManagement from "../components/StaffManagement";
import {
  apiDownload,
  apiGet,
  apiPatch,
  reauthenticate,
} from "../lib/api";
import type {
  DonationRecord,
  MemberRecord,
  ReportRecord,
  Role,
} from "../types";

export default function AdminDashboard() {
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [followUpNote, setFollowUpNote] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewalTier, setRenewalTier] = useState("");
  const [renewalDays, setRenewalDays] = useState("90");
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    memberId: string;
    role: Role;
  } | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [roleChangeBusy, setRoleChangeBusy] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
      apiGet<ReportRecord>("/reports/summary"),
      apiGet<{ members: MemberRecord[] }>("/members"),
      // The list endpoint is paginated, and this table renders every donation
      // it is given, so ask for the server's maximum explicitly. Without it the
      // default page size would silently truncate the table at ten rows.
      apiGet<{ donations: DonationRecord[] }>("/donations?page_size=100"),
    ])
      .then(
        ([
          reportResponse,
          memberResponse,
          donationResponse,
        ]) => {
          setReport(reportResponse);
          setMembers(memberResponse.members);
          setDonations(donationResponse.donations);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
  }, []);

  // The API contract makes staff_note optional for follow-up, so the note is
  // submitted only when one was typed.
  async function completeFollowUp(id: string) {
    const staffNote = followUpNote[id]?.trim();

    try {
      await apiPatch(`/donations/${id}/follow-up`, {
        ...(staffNote ? { staff_note: staffNote } : {}),
      });
      setDonations((current) =>
        current.map((donation) =>
          donation.id === id
            ? {
                ...donation,
                status: "followed_up",
                ...(staffNote ? { staff_note: staffNote } : {}),
              }
            : donation,
        ),
      );
      setActionMessage("Donation follow-up completed.");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to complete follow-up",
      );
    }
  }

  async function updateMemberRole(id: string, role: Role) {
    const token = await reauthenticate(reauthPassword);
    await apiPatch(`/members/${id}/role`, { role }, { "X-Reauth-Token": token });
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, role } : member)),
    );
    setPendingRoleChange(null);
    setReauthPassword("");
    setActionMessage("Member role updated.");
  }

  // Role changes are gated behind re-authentication, so a selection only
  // stages the change until the admin confirms with their password.
  function stageRoleChange(id: string, role: Role) {
    setActionMessage("");
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
      setActionMessage("Enter your password to confirm the role change.");
      return;
    }

    setRoleChangeBusy(true);
    setActionMessage("");
    try {
      await updateMemberRole(pendingRoleChange.memberId, pendingRoleChange.role);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to update member role",
      );
    } finally {
      setRoleChangeBusy(false);
    }
  }

  // PATCH /api/members/:id/renewal is off-contract; /tier is the contract's
  // manual renewal path and takes both values explicitly. The retired route
  // accepted an empty body, so the expiry the admin saw was one the client had
  // guessed and the server had never been told about.
  function startRenewal(member: MemberRecord) {
    setActionMessage("");
    setRenewingId(member.id);
    setRenewalTier(member.membership_tier ?? "free");
    setRenewalDays("90");
  }

  function cancelRenewal() {
    setRenewingId(null);
    setRenewalTier("");
  }

  async function renewMembership(
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) {
    event.preventDefault();
    const tier = renewalTier.trim();
    if (!tier) {
      setActionMessage("A membership tier is required.");
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
      // Reflect what the server stored rather than what we asked for.
      setMembers((current) =>
        current.map((member) =>
          member.id === id ? { ...member, ...response.member } : member,
        ),
      );
      setActionMessage(`Membership renewed to ${tier} for ${renewalDays} days.`);
      cancelRenewal();
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to renew membership",
      );
    }
  }

  async function exportDonations() {
    try {
      const blob = await apiDownload("/donations/export");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "donations.csv";
      link.click();
      URL.revokeObjectURL(url);
      setActionMessage("Donation export downloaded.");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to export donations",
      );
    }
  }

  if (status === "loading") return <p>Loading admin dashboard...</p>;
  if (status === "error")
    return <p role="alert">Unable to load admin dashboard.</p>;

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Admin dashboard</h1>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Bookings this month</p>
            <h2>{report?.bookings_this_month ?? 0}</h2>
          </div>
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Donations this period</p>
            <h2>R{(report?.donations_total ?? 0).toLocaleString()}</h2>
          </div>
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Active members</p>
            <h2>{report?.active_members ?? 0}</h2>
          </div>
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Pending requests</p>
            <h2>{report?.pending_requests ?? 0}</h2>
          </div>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 14,
              padding: "1rem",
            }}
          >
            <p>Booking conflicts</p>
            <h2>{report?.conflict_count ?? 0}</h2>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h3>Administration areas</h3>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Manage programmes</li>
          <li>Review campaigns</li>
          <li>Generate reports</li>
        </ul>
        <ProgrammeManagement />
        <CampaignManagement />
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
                    {/* The contract names no tiers, so this is free text rather
                        than a closed list we would have had to invent. */}
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

        <StaffManagement />

        <h3>Donation follow-up</h3>
        <button type="button" onClick={exportDonations}>
          Export donations CSV
        </button>
        {donations.length === 0 ? <p>No donations found.</p> : null}
        {actionMessage ? <p role="status">{actionMessage}</p> : null}
        <ul>
          {donations.map((donation) => (
            <li key={donation.id} style={{ marginBottom: "1rem" }}>
              <strong>
                R{Number(donation.amount).toLocaleString()} -{" "}
                {donation.campaigns?.title ?? "Campaign"}
              </strong>
              <div>
                {donation.donor_name ?? "Anonymous donor"} ({donation.status})
              </div>
              {donation.status === "pending_followup" ? (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.4rem",
                  }}
                >
                  <input
                    aria-label={`Follow-up note for donation ${donation.id}`}
                    placeholder="Staff note"
                    value={followUpNote[donation.id] ?? ""}
                    onChange={(event) =>
                      setFollowUpNote((current) => ({
                        ...current,
                        [donation.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => completeFollowUp(donation.id)}
                  >
                    Complete follow-up
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
