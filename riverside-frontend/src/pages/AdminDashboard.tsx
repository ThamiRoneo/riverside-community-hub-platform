import { useEffect, useState } from "react";
import AdminStats from "../components/AdminStats";
import CampaignManagement from "../components/CampaignManagement";
import DonationFollowUp from "../components/DonationFollowUp";
import MemberList from "../components/MemberList";
import ProgrammeManagement from "../components/ProgrammeManagement";
import StaffManagement from "../components/StaffManagement";
import {
  apiDownload,
  apiGet,
} from "../lib/api";
import type {
  MemberRecord,
  ReportRecord,
} from "../types";

export default function AdminDashboard() {
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<ReportRecord>("/reports/summary"),
      apiGet<{ members: MemberRecord[] }>("/members"),
    ])
      .then(([reportResponse, memberResponse]) => {
        setReport(reportResponse);
        setMembers(memberResponse.members);
      })
      .catch(() => setActionMessage("Unable to load admin dashboard."));
  }, []);

  async function exportReport() {
    setActionMessage("");
    try {
      const { blob, filename } = await apiDownload(
        "/reports/export?date_range=month",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "report.csv";
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage(`Report export downloaded as ${filename ?? "report.csv"}.`);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Unable to export the report",
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <AdminStats report={report} onExportReport={exportReport} />

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
        <MemberList
          members={members}
          onUpdateMembers={setMembers}
          onActionMessage={setActionMessage}
        />
        <StaffManagement />
        <DonationFollowUp onActionMessage={setActionMessage} />
        {actionMessage ? <p role="status">{actionMessage}</p> : null}
      </section>
    </div>
  );
}
