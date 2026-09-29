import { useEffect, useState, type FormEvent } from "react";
import {
  apiDownload,
  apiGet,
  apiPatch,
  apiPost,
  reauthenticate,
} from "../lib/api";
import type {
  CampaignRecord,
  DonationRecord,
  MemberRecord,
  ProgrammeRecord,
  ReportRecord,
  Role,
} from "../types";

export default function AdminDashboard() {
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [followUpNote, setFollowUpNote] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
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
      apiGet<ReportRecord>("/reports"),
      apiGet<{ members: MemberRecord[] }>("/members"),
      apiGet<{ programmes: ProgrammeRecord[] }>("/programmes"),
      apiGet<{ campaigns: CampaignRecord[] }>("/campaigns"),
      apiGet<{ donations: DonationRecord[] }>("/donations"),
    ])
      .then(
        ([
          reportResponse,
          memberResponse,
          programmeResponse,
          campaignResponse,
          donationResponse,
        ]) => {
          setReport(reportResponse);
          setMembers(memberResponse.members);
          setProgrammes(programmeResponse.programmes);
          setCampaigns(campaignResponse.campaigns);
          setDonations(donationResponse.donations);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
  }, []);

  async function completeFollowUp(id: string) {
    const staffNote = followUpNote[id]?.trim();
    if (!staffNote) {
      setActionMessage("Add a staff note before completing follow-up.");
      return;
    }

    try {
      await apiPatch(`/donations/${id}/follow-up`, { staff_note: staffNote });
      setDonations((current) =>
        current.map((donation) =>
          donation.id === id
            ? { ...donation, status: "followed_up", staff_note: staffNote }
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

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiPost("/members", {
        full_name: newMemberName,
        email: newMemberEmail,
        password: newMemberPassword,
      });
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberPassword("");
      setActionMessage("Member created successfully.");
      const response = await apiGet<{ members: MemberRecord[] }>("/members");
      setMembers(response.members);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to create member",
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

  async function renewMembership(id: string) {
    try {
      await apiPatch(`/members/${id}/renewal`, {});
      // Update the member's expiration date in the UI (assuming 30-day renewal)
      setMembers((current) =>
        current.map((member) =>
          member.id === id
            ? {
                ...member,
                membership_expires_at: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              }
            : member
        )
      );
      setActionMessage("Membership renewed successfully.");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to renew membership",
      );
    }
  }

  
  async function exportDonations() {
    try {
      const blob = await apiDownload("/donations/export.csv");
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
            <p>Total donations</p>
            <h2>R{(report?.total_donations ?? 0).toLocaleString()}</h2>
          </div>
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Active members</p>
            <h2>{report?.active_members ?? 0}</h2>
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
          <li>Manage staff accounts</li>
        </ul>
        <h3>Current programmes</h3>
        {programmes.length === 0 ? <p>No active programmes.</p> : null}
        <ul>
          {programmes.map((programme) => (
            <li key={programme.id}>{programme.title}</li>
          ))}
        </ul>
        <h3>Active campaigns</h3>
        {campaigns.length === 0 ? <p>No active campaigns.</p> : null}
        <ul>
          {campaigns.map((campaign) => (
            <li key={campaign.id}>{campaign.title}</li>
          ))}
        </ul>
        <h3>Recent members</h3>
        <form
          onSubmit={createMember}
          style={{
            display: "grid",
            gap: "0.5rem",
            maxWidth: 520,
            marginBottom: "1rem",
          }}
        >
          <input
            required
            placeholder="Full name"
            value={newMemberName}
            onChange={(event) => setNewMemberName(event.target.value)}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={newMemberEmail}
            onChange={(event) => setNewMemberEmail(event.target.value)}
          />
          <input
            required
            minLength={8}
            type="password"
            placeholder="Temporary password"
            value={newMemberPassword}
            onChange={(event) => setNewMemberPassword(event.target.value)}
          />
          <button type="submit">Create member</button>
        </form>
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
                  onClick={() => renewMembership(member.id)}
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
                  Renew 30 days
                </button>
              </div>
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
