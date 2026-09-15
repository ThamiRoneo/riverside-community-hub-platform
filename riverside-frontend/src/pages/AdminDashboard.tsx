import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type {
  CampaignRecord,
  MemberRecord,
  ProgrammeRecord,
  ReportRecord,
} from "../types";

export default function AdminDashboard() {
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
      apiGet<ReportRecord>("/reports"),
      apiGet<{ members: MemberRecord[] }>("/members"),
      apiGet<{ programmes: ProgrammeRecord[] }>("/programmes"),
      apiGet<{ campaigns: CampaignRecord[] }>("/campaigns"),
    ])
      .then(
        ([
          reportResponse,
          memberResponse,
          programmeResponse,
          campaignResponse,
        ]) => {
          setReport(reportResponse);
          setMembers(memberResponse.members);
          setProgrammes(programmeResponse.programmes);
          setCampaigns(campaignResponse.campaigns);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
  }, []);

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
        {members.length === 0 ? <p>No members found.</p> : null}
        <ul>
          {members.slice(0, 10).map((member) => (
            <li key={member.id}>
              {member.full_name} ({member.role})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
