import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import type {
  AvailabilitySlot,
  BookingRecord,
  MemberProfileRecord,
  NotificationRecord,
  ResourceRecord,
} from "../types";

/**
 * Reads an availability label as the wall-clock hour it names.
 *
 * "2026-10-06T10:00:00.000Z" is 10:00 on the hub's clock, not 10:00 UTC, so the
 * Z is dropped before parsing. Parsing it as UTC would shift every slot by the
 * reader's offset and quietly break the comparison.
 */
function slotHour(label: string): number {
  return new Date(label.replace(/Z$/, "")).getTime();
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [profile, setProfile] = useState<MemberProfileRecord | null>(null);
  const [membershipStatus, setMembershipStatus] = useState("not_set");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [peopleCount, setPeopleCount] = useState("1");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);

  // Availability is advisory, not a gate. It is fetched whenever the chosen
  // resource or start changes, and a failed fetch leaves it unknown rather than
  // blocking the form, because the backend refuses a clashing booking with a
  // 409 either way.
  useEffect(() => {
    if (!resourceId || !startAt) {
      setSlots(null);
      return;
    }
    const date = startAt.slice(0, 10);
    let stale = false;
    apiGet<{ slots: AvailabilitySlot[] }>(
      `/resources/${resourceId}/availability?date=${date}`,
    )
      .then((response) => {
        if (!stale) setSlots(response.slots);
      })
      .catch(() => {
        if (!stale) setSlots(null);
      });
    return () => {
      stale = true;
    };
  }, [resourceId, startAt]);

  // A clash is when any hour the request touches is already taken.
  //
  // Compared on the wall-clock label rather than as instants. The availability
  // endpoint stamps its opening-hour grid with a Z, but those labels are
  // wall-clock hours: a browser reading them as UTC puts every slot as many
  // hours off as its own offset, so a member in Johannesburg asking for 10:00
  // would be compared against 08:00 and the overlap would never be seen. What
  // the member typed is an hour on a wall clock, so compare it to the label the
  // same way.
  //
  // Hours outside the hub's opening times are not in the returned slots at all,
  // so they are neither available nor a clash.
  const clashes = useMemo(() => {
    if (!slots || !startAt || !endAt) return false;
    const startHour = new Date(startAt).getTime();
    const endHour = new Date(endAt).getTime();
    if (Number.isNaN(startHour) || Number.isNaN(endHour)) return false;
    return slots.some((slot) => {
      if (slot.status !== "unavailable") return false;
      return slotHour(slot.start_time) < endHour && startHour < slotHour(slot.end_time);
    });
  }, [slots, startAt, endAt]);

  // One catalogue, split only so the picker can group its options.
  const rooms = resources.filter((resource) => resource.type === "room");
  const equipment = resources.filter((resource) => resource.type === "equipment");

  async function loadBookings() {
    const response = await apiGet<{ bookings: BookingRecord[] }>(
      "/bookings/mine",
    );
    setBookings(response.bookings);
  }

  useEffect(() => {
    Promise.all([
      loadBookings(),
      apiGet<{ resources: ResourceRecord[] }>("/resources?page_size=100"),
      apiGet<MemberProfileRecord>("/profile/me"),
      apiGet<{ notifications: NotificationRecord[] }>("/notifications"),
    ])
      .then(
        ([, resourceResponse, profileResponse, notificationResponse]) => {
          setResources(resourceResponse.resources);
          setProfile(profileResponse);
          setMembershipStatus(
            profileResponse.expiring_soon ? "expiring_soon" : "active",
          );
          setProfileName(profileResponse.full_name);
          setProfilePhone(profileResponse.contact_phone ?? "");
          setNotifications(notificationResponse.notifications);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
  }, []);

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      await apiPost("/bookings", {
        resource_id: resourceId,
        start_time: new Date(startAt).toISOString(),
        end_time: new Date(endAt).toISOString(),
        purpose,
        contact_phone: profilePhone,
        people_count: Number(peopleCount),
        ...(accessibilityNotes
          ? { accessibility_notes: accessibilityNotes }
          : {}),
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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await apiPatch<MemberProfileRecord>(
        "/profile/me",
        { full_name: profileName, contact_phone: profilePhone || null },
      );
      setProfile(response);
      setProfilePhone(response.contact_phone ?? "");
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update profile",
      );
    }
  }

  async function markNotificationRead(id: string) {
    try {
      await apiPatch(`/notifications/${id}/read`, {});
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, read: true }
            : notification,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update notification",
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
          <strong>Name:</strong> {profile?.full_name ?? user?.fullName}
        </p>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
        <p>
          <strong>Membership:</strong> {user?.membershipTier ?? "Standard"}
        </p>
        <p>
          <strong>Status:</strong> {membershipStatus.replace("_", " ")}
        </p>
        <form
          onSubmit={saveProfile}
          style={{ display: "grid", gap: "0.6rem", maxWidth: 520 }}
        >
          <label>
            Full name
            <input
              required
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
            />
          </label>
          <button type="submit">Save profile</button>
        </form>
      </section>

      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h2>Notifications</h2>
        {notifications.length === 0 ? <p>No notifications yet.</p> : null}
        <ul>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <span style={{ fontWeight: notification.read ? 400 : 700 }}>
                {notification.message}
              </span>{" "}
              {!notification.read ? (
                <button
                  type="button"
                  onClick={() => markNotificationRead(notification.id)}
                >
                  Mark as read
                </button>
              ) : null}
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
            aria-label="Choose a room or equipment"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          >
            <option value="">Choose a room or equipment</option>
            <optgroup label="Rooms">
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
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
          <label>
            Purpose
            <input
              required
              minLength={2}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Community meeting"
            />
          </label>
          <label>
            Number of people
            <input
              required
              type="number"
              min={1}
              value={peopleCount}
              onChange={(event) => setPeopleCount(event.target.value)}
            />
          </label>
          <label>
            Accessibility needs
            <textarea
              value={accessibilityNotes}
              onChange={(event) => setAccessibilityNotes(event.target.value)}
              rows={2}
            />
          </label>
          {clashes ? (
            <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>
              Some of that time is already booked. Choose another slot, or send
              the request anyway and staff will decide.
            </p>
          ) : null}
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
