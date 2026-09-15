import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../lib/api";
import type { BookingRecord, EquipmentRecord, FacilityRecord } from "../types";

export default function StaffDashboard() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [staffNote, setStaffNote] = useState("");

  async function loadData() {
    const [bookingResponse, facilityResponse, equipmentResponse] =
      await Promise.all([
        apiGet<{ bookings: BookingRecord[] }>("/bookings"),
        apiGet<{ facilities: FacilityRecord[] }>("/facilities"),
        apiGet<{ equipment: EquipmentRecord[] }>("/equipment"),
      ]);
    setBookings(bookingResponse.bookings);
    setFacilities(facilityResponse.facilities);
    setEquipment(equipmentResponse.equipment);
  }

  useEffect(() => {
    loadData()
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
  }, []);

  async function updateBooking(id: string, action: "approve" | "reject") {
    if (action === "reject" && !staffNote.trim()) {
      setMessage("A note is required when rejecting a booking.");
      return;
    }
    try {
      await apiPatch(`/bookings/${id}/${action}`, {
        staff_note: staffNote.trim() || "Approved",
      });
      setStaffNote("");
      setRejectingId(null);
      setMessage(`Booking ${action}d successfully.`);
      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : `Unable to ${action} booking`,
      );
    }
  }

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
        {status === "loading" ? <p>Loading bookings...</p> : null}
        {status === "error" ? (
          <p role="alert">Unable to load staff data.</p>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
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
                  <strong>
                    {booking.profiles?.full_name ??
                      booking.profiles?.email ??
                      "Member"}
                  </strong>
                  <div>
                    {booking.facilities?.name ??
                      booking.equipment?.name ??
                      "Resource"}
                  </div>
                  <small>{new Date(booking.start_at).toLocaleString()}</small>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => updateBooking(booking.id, "approve")}
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
                    onClick={() => setRejectingId(booking.id)}
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
                {rejectingId === booking.id ? (
                  <div
                    style={{ display: "grid", gap: "0.5rem", width: "100%" }}
                  >
                    <label>
                      Rejection note
                      <textarea
                        value={staffNote}
                        onChange={(event) => setStaffNote(event.target.value)}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => updateBooking(booking.id, "reject")}
                    >
                      Confirm rejection
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          {status === "ready" &&
          !bookings.some((booking) => booking.status === "pending") ? (
            <li>No pending bookings.</li>
          ) : null}
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
          {[
            ...facilities.map((resource) => ({
              ...resource,
              type: "Facility",
              detail: `Capacity: ${resource.capacity ?? "Flexible"}`,
            })),
            ...equipment.map((resource) => ({
              ...resource,
              type: "Equipment",
              detail: `Quantity: ${resource.quantity}`,
            })),
          ].map((resource) => (
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
              <p>{resource.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
