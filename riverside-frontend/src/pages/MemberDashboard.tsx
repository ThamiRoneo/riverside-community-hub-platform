import { bookings } from "../data/mockData";
import { useAuth } from "../context/AuthContext";

export default function MemberDashboard() {
  const { user } = useAuth();

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
        <h1 style={{ marginTop: 0 }}>Member dashboard</h1>
        <p>
          <strong>Name:</strong> {user?.fullName}
        </p>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
        <p>
          <strong>Membership:</strong> {user?.membershipTier ?? "Standard"}
        </p>
        <p>
          <strong>Status:</strong> Expiring soon
        </p>
      </section>

      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h2>My bookings</h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: "0.75rem",
          }}
        >
          {bookings.map((booking) => (
            <li
              key={booking.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "0.9rem 1rem",
              }}
            >
              <div>
                <strong>{booking.title}</strong>
                <div>{booking.resource}</div>
                <small>{booking.date}</small>
              </div>
              <span
                style={{
                  background: "#fef3c7",
                  color: "#854d0e",
                  padding: "0.4rem 0.7rem",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                {booking.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
