

import type { BookingRecord } from "../types";

interface BookingListProps {
  bookings: BookingRecord[];
  status: string;
  onCancel: (id: string) => void;
}

export default function BookingList({
  bookings,
  status,
  onCancel,
}: BookingListProps) {
  return (
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
        {status === "loading" ? <p>Loading bookings...</p> : null}
        {status === "ready" && bookings.length === 0 ? (
          <p>No bookings yet.</p>
        ) : null}
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
              <strong>{booking.resource_name ?? "Resource"}</strong>
              <small>{new Date(booking.start_at).toLocaleString()}</small>
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
            {booking.status === "pending" || booking.status === "approved" ? (
              <button type="button" onClick={() => onCancel(booking.id)}>
                Cancel
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
