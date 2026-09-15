import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  BookingApproveSchema,
  BookingCreateSchema,
  BookingRejectSchema,
} from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const query = supabaseAdmin
    .from("bookings")
    .select(
      "id, member_id, facility_id, equipment_id, start_at, end_at, status, staff_note, created_at, profiles(full_name, email), facilities(name), equipment(name)",
    )
    .order("start_at");

  if (req.user?.role === "member") query.eq("member_id", req.user.id);
  else if (req.user?.role !== "staff" && req.user?.role !== "admin")
    return res.status(403).json({ error: "Insufficient role" });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Unable to load bookings" });
  return res.status(200).json({ bookings: data ?? [] });
});

router.post("/", requireAuth, async (req, res) => {
  const result = BookingCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  const { facility_id, equipment_id, start_at, end_at } = result.data;
  const conflictQuery = supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("status", "approved")
    .lt("start_at", end_at)
    .gt("end_at", start_at)
    .limit(1);

  if (facility_id) conflictQuery.eq("facility_id", facility_id);
  if (equipment_id) conflictQuery.eq("equipment_id", equipment_id);
  const { data: conflicts, error: conflictError } = await conflictQuery;
  if (conflictError)
    return res.status(500).json({ error: "Unable to check availability" });
  if (conflicts?.length)
    return res
      .status(409)
      .json({ error: "Resource is already booked for that time" });

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({ ...result.data, member_id: req.user?.id })
    .select(
      "id, member_id, facility_id, equipment_id, start_at, end_at, status, created_at",
    )
    .single();

  if (error) return res.status(500).json({ error: "Unable to create booking" });
  return res.status(201).json({ message: "Booking created", booking: data });
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
      .select("facility_id, equipment_id, start_at, end_at")
      .eq("id", req.params.id)
      .single();
    if (bookingError || !booking)
      return res.status(404).json({ error: "Booking not found" });

    const conflictQuery = supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("status", "approved")
      .neq("id", req.params.id)
      .lt("start_at", booking.end_at)
      .gt("end_at", booking.start_at)
      .limit(1);
    if (booking.facility_id)
      conflictQuery.eq("facility_id", booking.facility_id);
    if (booking.equipment_id)
      conflictQuery.eq("equipment_id", booking.equipment_id);
    const { data: conflicts, error: conflictError } = await conflictQuery;
    if (conflictError)
      return res.status(500).json({ error: "Unable to check availability" });
    if (conflicts?.length)
      return res
        .status(409)
        .json({ error: "Resource is already booked for that time" });

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "approved", staff_note: result.data.staff_note })
      .eq("id", req.params.id);
    if (error)
      return res.status(500).json({ error: "Unable to approve booking" });
    return res
      .status(200)
      .json({ message: `Booking ${req.params.id} approved` });
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
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "rejected", staff_note: result.data.staff_note })
      .eq("id", req.params.id);
    if (error)
      return res.status(500).json({ error: "Unable to reject booking" });
    return res
      .status(200)
      .json({ message: `Booking ${req.params.id} rejected` });
  },
);

router.patch("/:id/cancel", requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", req.params.id)
    .eq("member_id", req.user?.id)
    .in("status", ["pending", "approved"]);
  if (error) return res.status(500).json({ error: "Unable to cancel booking" });
  return res
    .status(200)
    .json({ message: `Booking ${req.params.id} cancelled` });
});

export default router;
