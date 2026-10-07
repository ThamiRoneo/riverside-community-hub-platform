import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { AvailabilitySlot, ResourceRecord } from "../types";
import { apiGet } from "../lib/api";

function slotHour(label: string): number {
  return new Date(label.replace(/Z$/, "")).getTime();
}

interface BookingFormProps {
  resources: ResourceRecord[];
  resourceId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  peopleCount: string;
  accessibilityNotes: string;
  status: string;
  message: string;
  onResourceChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onPeopleChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function BookingForm({
  resources,
  resourceId,
  startAt,
  endAt,
  purpose,
  peopleCount,
  accessibilityNotes,
  status,
  message,
  onResourceChange,
  onStartChange,
  onEndChange,
  onPurposeChange,
  onPeopleChange,
  onNotesChange,
  onSubmit,
}: BookingFormProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
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

  const rooms = resources.filter((resource) => resource.type === "room");
  const equipment = resources.filter((resource) => resource.type === "equipment");

  return (
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
        onSubmit={onSubmit}
        style={{ display: "grid", gap: "0.8rem", maxWidth: 560 }}
      >
        <select
          required
          aria-label="Choose a room or equipment"
          value={resourceId}
          onChange={(event) => onResourceChange(event.target.value)}
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
            onChange={(event) => onStartChange(event.target.value)}
          />
        </label>
        <label>
          End time
          <input
            required
            type="datetime-local"
            value={endAt}
            onChange={(event) => onEndChange(event.target.value)}
          />
        </label>
        <label>
          Purpose
          <input
            required
            minLength={2}
            value={purpose}
            onChange={(event) => onPurposeChange(event.target.value)}
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
            onChange={(event) => onPeopleChange(event.target.value)}
          />
        </label>
        <label>
          Accessibility needs
          <textarea
            value={accessibilityNotes}
            onChange={(event) => onNotesChange(event.target.value)}
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
  );
}
