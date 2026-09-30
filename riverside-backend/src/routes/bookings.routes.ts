import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { findApprovedOverlaps } from "../lib/bookings";
import { dayBounds, overlaps } from "../lib/dates";
import { sendRowError } from "../lib/http";
import { pagination } from "../lib/pagination";
import { resolveResource } from "../lib/resources";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  BookingApproveSchema,
  BookingCreateSchema,
  BookingRejectSchema,
} from "../validation/schemas";

const router = Router();

type BookingRow = Record<string, any> & {
  resource_id: string | null;
  resource_type: "room" | "equipment" | null;
  resource_name: string | null;
  member_name: string | null;
};

/**
 * The resource a booking points at, flattened out of the two nullable columns.
 * The contract exposes a single `resource_id`, so that is what callers see.
 */
function toBooking(row: Record<string, any>): BookingRow {
  const facility = Array.isArray(row.facilities) ? row.facilities[0] : row.facilities;
  const equipment = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
  const member = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    ...row,
    resource_id: row.facility_id ?? row.equipment_id ?? null,
    resource_type: row.facility_id ? "room" : row.equipment_id ? "equipment" : null,
    resource_name: facility?.name ?? equipment?.name ?? null,
    member_name: member?.full_name ?? null,
  };
}

const BOOKING_COLUMNS =
  "id, member_id, facility_id, equipment_id, purpose, accessibility_notes, " +
  "contact_phone, people_count, start_at, end_at, status, staff_note, created_at, " +
  "profiles(full_name), facilities(name), equipment(name)";

// Must stay in sync with the public.booking_status enum in migration 0001.
const BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled"];

/**
 * Ids in `candidates` that overlap an already-approved booking on the same
 * resource. Approval re-checks conflicts, so the queue reports the clash ahead
 * of time instead of leaving it to be discovered during a decision.
 *
 * One extra query covers the whole page rather than one per booking.
 */
async function conflictIds(candidates: BookingRow[]): Promise<Set<string>> {
  const clashing = new Set<string>();
  if (candidates.length === 0) return clashing;

  const starts = candidates.map((b) => b.start_at).sort();
  const ends = candidates.map((b) => b.end_at).sort();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, facility_id, equipment_id, start_at, end_at")
    .eq("status", "approved")
    .lt("start_at", ends[ends.length - 1])
    .gt("end_at", starts[0]);

  if (error) return clashing;

  const approved = data ?? [];
  for (const candidate of candidates) {
    const clash = approved.some(
      (other) =>
        other.id !== candidate.id &&
        ((candidate.facility_id && other.facility_id === candidate.facility_id) ||
          (candidate.equipment_id && other.equipment_id === candidate.equipment_id)) &&
        overlaps(candidate.start_at, candidate.end_at, other.start_at, other.end_at),
    );
    if (clash) clashing.add(candidate.id);
  }

  return clashing;
}

async function notifyBookingMember(
  bookingId: string,
  userId: string,
  message: string,
) {
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    booking_id: bookingId,
    message,
  });
}

// GET /api/bookings/mine
// Contract: the member's own bookings, split into upcoming and past. `status`
// narrows the list; the counts always describe the whole set so a filtered view
// still shows how much is outstanding.
router.get("/mine", requireAuth, requireRole("member"), async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !BOOKING_STATUSES.includes(String(status)))
    return res
      .status(400)
      .json({ error: `status must be one of: ${BOOKING_STATUSES.join(", ")}` });

  let query = supabaseAdmin
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("member_id", req.user!.id)
    .order("start_at");

  if (status !== undefined) query = query.eq("status", String(status));

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Unable to load bookings" });

  const now = new Date().toISOString();
  const all = (data ?? []).map(toBooking);
  // Sorted by start_at, so the split is a binary search rather than a filter.
  const firstUpcoming = all.findIndex((b) => b.start_at >= now);
  const upcoming_count =
    firstUpcoming === -1 ? 0 : all.length - firstUpcoming;
  const past_count = all.length - upcoming_count;

  const { pageSize, offset } = pagination(req.query);
  return res.status(200).json({
    bookings: all.slice(offset, offset + pageSize),
    total: all.length,
    upcoming_count,
    past_count,
  });
});

// GET /api/bookings/queue
// Contract: staff and admin, defaulting to pending. Every item carries
// has_conflict so the queue can surface a request that overlaps a booking
// approved after it was raised.
router.get("/queue", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const { status = "pending", resource_type, date, search } = req.query;
  if (!BOOKING_STATUSES.includes(String(status)))
    return res
      .status(400)
      .json({ error: `status must be one of: ${BOOKING_STATUSES.join(", ")}` });

  if (resource_type !== undefined && !["room", "equipment"].includes(String(resource_type)))
    return res
      .status(400)
      .json({ error: "resource_type must be one of: room, equipment" });

  let query = supabaseAdmin
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("status", String(status))
    .order("start_at");

  if (resource_type === "room") query = query.not("facility_id", "is", null);
  if (resource_type === "equipment") query = query.not("equipment_id", "is", null);

  if (date !== undefined) {
    const bounds = dayBounds(String(date));
    if (!bounds) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    query = query.gte("start_at", bounds.start).lt("start_at", bounds.end);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Unable to load bookings" });

  let candidates = (data ?? []).map(toBooking);

  // Search spans the member, the resource and the purpose, all of which are
  // only available after the join.
  if (search) {
    const needle = String(search).toLowerCase();
    candidates = candidates.filter((booking) =>
      `${booking.member_name ?? ""} ${booking.resource_name ?? ""} ${booking.purpose ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }

  const conflicts = await conflictIds(candidates);
  const withConflict = candidates.map((booking) => ({
    ...booking,
    has_conflict: conflicts.has(booking.id),
  }));

  const { pageSize, offset } = pagination(req.query);
  return res.status(200).json({
    bookings: withConflict.slice(offset, offset + pageSize),
    total: withConflict.length,
    conflict_count: withConflict.filter((booking) => booking.has_conflict).length,
  });
});

// GET /api/bookings/:id
// A member may only read their own; staff and admins may read any.
router.get("/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("id", req.params.id)
    .single();

  if (error || !data)
    return res.status(404).json({ error: "Booking not found" });

  const booking = toBooking(data);
  if (req.user!.role === "member" && booking.member_id !== req.user!.id)
    return res.status(403).json({ error: "You can only view your own booking" });

  return res.status(200).json(booking);
});

// POST /api/bookings
// Contract: member action. Without the role guard any authenticated user,
// including staff and admins, could book under their own profile id and appear
// in the member booking list.
router.post("/", requireAuth, requireRole("member"), async (req, res) => {
  const result = BookingCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  const { resource_id, start_time, end_time, purpose, accessibility_notes, contact_phone, people_count } = result.data;

  // resource_id spans two tables, so resolve it before anything is written.
  const resolved = await resolveResource(resource_id);
  if (!resolved)
    return res.status(404).json({ error: "Resource not found" });

  const conflicts = await findApprovedOverlaps(
    {
      facilityId: resolved.type === "room" ? resource_id : null,
      equipmentId: resolved.type === "equipment" ? resource_id : null,
    },
    start_time,
    end_time,
  );
  if (conflicts.length)
    return res.status(409).json({ error: "slot_unavailable" });

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      member_id: req.user!.id,
      facility_id: resolved.type === "room" ? resource_id : null,
      equipment_id: resolved.type === "equipment" ? resource_id : null,
      start_at: start_time,
      end_at: end_time,
      purpose,
      accessibility_notes: accessibility_notes ?? null,
      contact_phone,
      people_count,
    })
    .select(BOOKING_COLUMNS)
    .single();

  if (error) return res.status(500).json({ error: "Unable to create booking" });
  return res.status(201).json(toBooking(data));
});

router.patch(
  "/:id/approve",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = BookingApproveSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("member_id, facility_id, equipment_id, start_at, end_at")
      .eq("id", req.params.id)
      .single();
    if (bookingError || !booking)
      return res.status(404).json({ error: "Booking not found" });

    // The contract requires conflicts to be re-checked at approval, not only
    // when the request was made: another booking may have been approved since.
    let conflicts: string[];
    try {
      conflicts = await findApprovedOverlaps(
        {
          facilityId: booking.facility_id,
          equipmentId: booking.equipment_id,
        },
        booking.start_at,
        booking.end_at,
        req.params.id,
      );
    } catch {
      return res.status(500).json({ error: "Unable to check availability" });
    }
    if (conflicts.length)
      return res.status(409).json({ error: "slot_unavailable" });

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "approved", staff_note: result.data.staff_note })
      .eq("id", req.params.id);
    if (error)
      return res.status(500).json({ error: "Unable to approve booking" });
    await notifyBookingMember(
      req.params.id,
      booking.member_id,
      "Your booking request was approved.",
    );
    return res.status(200).json({ id: req.params.id, status: "approved" });
  },
);

router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = BookingRejectSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("member_id")
      .eq("id", req.params.id)
      .single();
    if (bookingError || !booking)
      return res.status(404).json({ error: "Booking not found" });

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "rejected", staff_note: result.data.staff_note })
      .eq("id", req.params.id);
    if (error)
      return res.status(500).json({ error: "Unable to reject booking" });
    await notifyBookingMember(
      req.params.id,
      booking.member_id,
      "Your booking request was rejected.",
    );
    return res.status(200).json({ id: req.params.id, status: "rejected" });
  },
);

// PATCH /api/bookings/:id/cancel
// Member's own booking, and only while it is still pending or approved.
// The previous implementation issued the UPDATE and trusted a null error,
// which reported success even when zero rows matched.
router.patch("/:id/cancel", requireAuth, async (req, res) => {
  const { data: booking, error: lookupError } = await supabaseAdmin
    .from("bookings")
    .select("id, member_id, status")
    .eq("id", req.params.id)
    .single();

  if (lookupError || !booking)
    return sendRowError(
      res,
      lookupError,
      "Booking not found",
      "Unable to load booking",
    );

  if (booking.member_id !== req.user!.id)
    return res.status(403).json({ error: "You can only cancel your own booking" });

  if (!["pending", "approved"].includes(booking.status))
    return res.status(409).json({
      error: `A ${booking.status} booking cannot be cancelled`,
    });

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", req.params.id);

  if (error)
    return res.status(500).json({ error: "Unable to cancel booking" });

  await notifyBookingMember(
    req.params.id,
    req.user!.id,
    "Your booking was cancelled.",
  );

  return res.status(200).json({ id: req.params.id, status: "cancelled" });
});

export default router;
