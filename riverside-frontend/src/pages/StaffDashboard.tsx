import { bookings, resources } from "../data/mockData";

export default function StaffDashboard() {
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
        <h1 style={{ marginTop: 0 }}>Staff dashboard</h1>
        <h3>Pending bookings</h3>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: "0.75rem",
          }}
        >
          {bookings
            .filter((booking) => booking.status === "pending")
            .map((booking) => (
              <li
                key={booking.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "0.9rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div>
                  <strong>{booking.member}</strong>
                  <div>{booking.resource}</div>
                  <small>{booking.date}</small>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    style={{
                      background: "#22c55e",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "0.5rem 0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    style={{
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "0.5rem 0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h3>Inventory overview</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {resources.map((resource) => (
            <div
              key={resource.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "1rem",
              }}
            >
              <strong>{resource.name}</strong>
              <p>{resource.type}</p>
              <p>{resource.availability}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
