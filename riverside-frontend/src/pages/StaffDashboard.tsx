import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { BookingRecord, ResourceRecord, ResourceType } from "../types";

export default function StaffDashboard() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [staffNote, setStaffNote] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("room");
  const [resourceCapacity, setResourceCapacity] = useState("");

  async function loadData() {
    // The queue defaults to pending server-side, so nothing is filtered here.
    const [queueResponse, resourceResponse] = await Promise.all([
      apiGet<{
        bookings: BookingRecord[];
        conflict_count: number;
      }>("/bookings/queue"),
      apiGet<{ resources: ResourceRecord[] }>("/resources?page_size=100"),
    ]);
    setBookings(queueResponse.bookings);
    setConflictCount(queueResponse.conflict_count);
    setResources(resourceResponse.resources);
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

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiPost("/resources", {
        name: resourceName,
        type: resourceType,
        capacity: Number(resourceCapacity),
        description: resourceDescription || undefined,
      });
      setResourceName("");
      setResourceDescription("");
      setResourceCapacity("");
      setMessage("Resource created successfully.");
      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create resource",
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section style={sectionStyle}>
        <h1 style={{ marginTop: 0 }}>Staff dashboard</h1>
        {status === "loading" ? <p>Loading bookings...</p> : null}
        {status === "error" ? (
          <p role="alert">Unable to load staff data.</p>
        ) : null}
        {message ? <p role="status">{message}</p> : null}

        <h2>Pending bookings</h2>
        {conflictCount > 0 ? (
          <p role="status">
            {conflictCount} of these clash with an already approved booking.
          </p>
        ) : null}

        <ul style={listStyle}>
          {bookings.map((booking) => (
            <li key={booking.id} style={itemStyle}>
              <div>
                <strong>{booking.member_name ?? "Member"}</strong>
                <div>{booking.resource_name ?? "Resource"}</div>
                <small>{new Date(booking.start_at).toLocaleString()}</small>
                {booking.has_conflict ? (
                  <div style={conflictBadge}>Clashes with another booking</div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => updateBooking(booking.id, "approve")}
                  style={approveStyle}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingId(booking.id)}
                  style={rejectStyle}
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
          {status === "ready" && bookings.length === 0 ? (
            <li>No pending bookings.</li>
          ) : null}
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>Add resource</h2>
        <form onSubmit={createResource} style={formStyle}>
          <select
            value={resourceType}
            onChange={(event) =>
              setResourceType(event.target.value as ResourceType)
            }
          >
            <option value="room">Room</option>
            <option value="equipment">Equipment</option>
          </select>
          <input
            required
            placeholder="Name"
            aria-label="Resource name"
            value={resourceName}
            onChange={(event) => setResourceName(event.target.value)}
          />
          <input
            placeholder="Description"
            aria-label="Description"
            value={resourceDescription}
            onChange={(event) => setResourceDescription(event.target.value)}
          />
          <input
            required
            min="1"
            type="number"
            placeholder="Capacity"
            aria-label="Capacity"
            value={resourceCapacity}
            onChange={(event) => setResourceCapacity(event.target.value)}
          />
          <button type="submit">Add resource</button>
        </form>

        <h2>Inventory overview</h2>
        {resources.length === 0 ? (
          <p role="status">
            No rooms or equipment yet. Add one with the form above.
          </p>
        ) : (
          <>
            <p style={mutedStyle}>
              {resources.length} {resources.length === 1 ? "resource" : "resources"}{" "}
              available to book.
            </p>
            <ul style={inventoryStyle} role="list">
              {resources.map((resource) => (
                <li key={resource.id} style={inventoryCardStyle}>
                  <div style={inventoryHeaderStyle}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>
                      {resource.name}
                    </h3>
                    <span style={inventoryBadge}>
                      {resource.type === "room" ? "Room" : "Equipment"}
                    </span>
                  </div>
                  <p style={inventoryMeta}>
                    {resource.capacity
                      ? `Up to ${resource.capacity} people`
                      : "No capacity limit"}
                  </p>
                  {resource.description ? (
                    <p style={inventoryDescription}>{resource.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

const sectionStyle = {
  background: "white",
  borderRadius: 18,
  padding: "1.5rem",
  boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
};

const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid" as const,
  gap: "0.75rem",
};

const itemStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "0.9rem 1rem",
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
};

const formStyle = {
  display: "grid",
  gap: "0.6rem",
  maxWidth: 560,
  marginBottom: "1.5rem",
};

// Inventory cards stack their own content, so they need their own style. The
// booking row style is display:flex with space-between, which is right when
// details sit beside buttons but squeezes three stacked fields into a column.
const inventoryStyle = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  // The min() keeps the floor from forcing an overflow on a narrow phone.
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
  gap: "1rem",
};

const inventoryCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "1rem",
};

const inventoryHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.75rem",
};

const inventoryBadge = {
  background: "#dcfce7",
  color: "#1f2937",
  padding: "0.2rem 0.55rem",
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

const inventoryMeta = {
  margin: "0.5rem 0 0",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#334155",
};

const inventoryDescription = {
  margin: "0.35rem 0 0",
  fontSize: "0.875rem",
  color: "#64748b",
};

const mutedStyle = { color: "#64748b", marginTop: "-0.5rem" };

const approveStyle = {
  background: "#22c55e",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "0.5rem 0.8rem",
  fontWeight: 700,
};

const rejectStyle = {
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "0.5rem 0.8rem",
  fontWeight: 700,
};

const conflictBadge = {
  marginTop: "0.4rem",
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  padding: "0.25rem 0.6rem",
  borderRadius: 999,
  fontSize: "0.8rem",
  fontWeight: 700,
};