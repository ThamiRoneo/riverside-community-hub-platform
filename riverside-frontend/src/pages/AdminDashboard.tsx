export default function AdminDashboard() {
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
            <h2>64</h2>
          </div>
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Total donations</p>
            <h2>R124,500</h2>
          </div>
          <div
            style={{ background: "#f8fafc", borderRadius: 14, padding: "1rem" }}
          >
            <p>Active members</p>
            <h2>382</h2>
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
      </section>
    </div>
  );
}
