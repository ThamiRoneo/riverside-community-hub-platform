import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import type { BookingRecord, EquipmentRecord, FacilityRecord } from "../types";

export default function MemberDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  async function loadBookings() {
    const response = await apiGet<{ bookings: BookingRecord[] }>("/bookings");
    setBookings(response.bookings);
  }

  useEffect(() => {
    Promise.all([
      loadBookings(),
      apiGet<{ facilities: FacilityRecord[] }>("/facilities"),
      apiGet<{ equipment: EquipmentRecord[] }>("/equipment"),
    ])
      .then(([, facilityResponse, equipmentResponse]) => {
        setFacilities(facilityResponse.facilities);
        setEquipment(equipmentResponse.equipment);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const isFacility = facilities.some(
      (facility) => facility.id === resourceId,
    );
    try {
      await apiPost("/bookings", {
        ...(isFacility
          ? { facility_id: resourceId }
          : { equipment_id: resourceId }),
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
      });
      await loadBookings();
      setMessage("Booking request submitted for staff approval.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create booking",
      );
    }
  }

  async function cancelBooking(id: string) {
    try {
      await apiPatch(`/bookings/${id}/cancel`, {});
      await loadBookings();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to cancel booking",
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
        <h2>Request a booking</h2>
        {status === "loading" ? <p>Loading resources...</p> : null}
        {status === "error" ? (
          <p role="alert">Unable to load booking resources.</p>
        ) : null}
        <form
          onSubmit={handleBookingSubmit}
          style={{ display: "grid", gap: "0.8rem", maxWidth: 560 }}
        >
          <select
            required
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          >
            <option value="">Choose a facility or equipment</option>
            <optgroup label="Facilities">
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Equipment">
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
          <label>
            Start time
            <input
              required
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </label>
          <label>
            End time
            <input
              required
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </label>
          <button
            type="submit"
            style={{
              background: "#1d3557",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "0.8rem",
              fontWeight: 700,
            }}
          >
            Request booking
          </button>
        </form>
        {message ? <p role="status">{message}</p> : null}
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
                <strong>
                  {booking.facilities?.name ??
                    booking.equipment?.name ??
                    "Resource"}
                </strong>
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
                <button type="button" onClick={() => cancelBooking(booking.id)}>
                  Cancel
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
