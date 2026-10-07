import type { ReportRecord } from "../types";

interface AdminStatsProps {
  report: ReportRecord | null;
  onExportReport: () => void;
}

export default function AdminStats({ report, onExportReport }: AdminStatsProps) {
  return (
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
      <div style={{ marginTop: "1rem" }}>
        <button type="button" onClick={onExportReport}>
          Export this report as CSV
        </button>
      </div>
    </section>
  );
}
