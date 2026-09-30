import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { requireReauth } from "../middleware/reauth";
import { MemberUpdateSchema } from "../validation/schemas";

const router = Router();

// Must stay in sync with the public.booking_status enum in migration 0001.
const BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled"];

const PROFILE_COLUMNS =
  "id, full_name, phone, role, membership_tier, membership_expires_at, created_at";

// GET /api/members (with pagination and filtering)
router.get("/", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const { search, tier, status, page, page_size } = req.query;

  // An unrecognised filter value is a client bug. Reject it rather than
  // silently returning the unfiltered list.
  const validStatus = ["active", "expired"];
  if (status !== undefined && !validStatus.includes(String(status))) {
    return res.status(400).json({
      error: `status must be one of: ${validStatus.join(", ")}`,
    });
  }

  const pageNum = Math.max(1, parseInt(String(page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(page_size ?? "10"), 10) || 10),
  );
  const offset = (pageNum - 1) * pageSize;

  let query = supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS, { count: "exact" });

  if (search) {
    query = query.ilike("full_name", `%${search}%`);
  }

  if (tier) {
    query = query.eq("membership_tier", String(tier));
  }

  // profiles has no `status` column; membership state is derived from
  // membership_expires_at. A null expiry is treated as active. The `lt`
  // comparison already excludes nulls, so no extra null filter is needed.
  const nowIso = new Date().toISOString();
  if (status === "expired") {
    query = query.lt("membership_expires_at", nowIso);
  } else if (status === "active") {
    query = query.or(
      `membership_expires_at.is.null,membership_expires_at.gte.${nowIso}`,
    );
  }

  const { data, error, count } = await query
    .range(offset, offset + pageSize - 1)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Unable to load members" });

  return res.status(200).json({
    members: data ?? [],
    total: count ?? 0,
    page: pageNum,
    page_size: pageSize,
  });
});

// GET /api/members/:id
// GET /api/members/:id
// Contract: "profile + booking history summary". The summary reuses the reports
// by_status shape so the codebase has one representation of a status breakdown,
// and splits upcoming from past by time exactly as GET /api/bookings/mine does.
router.get("/:id", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", req.params.id)
    .single();

  if (error || !data)
    return sendRowError(
      res,
      error,
      "Member not found",
      "Unable to load member",
    );

  // One fetch and a filter, rather than a second aggregate round trip: a member
  // has a handful of bookings, so the arithmetic costs nothing next to a query.
  const { data: bookings, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("start_at, status")
    .eq("member_id", data.id);

  if (bookingError)
    return res.status(500).json({ error: "Unable to load booking history" });

  const rows = bookings ?? [];
  const now = new Date().toISOString();
  const upcoming_count = rows.filter((b) => b.start_at >= now).length;

  return res.status(200).json({
    ...data,
    booking_history: {
      total: rows.length,
      upcoming_count,
      past_count: rows.length - upcoming_count,
      by_status: BOOKING_STATUSES.map((status) => ({
        status,
        count: rows.filter((b) => b.status === status).length,
      })),
    },
  });
});


// PATCH /api/members/:id/tier
router.patch("/:id/tier", requireAuth, requireRole("admin"), async (req, res) => {
  
  const { membership_tier, membership_expires_at } = req.body;
  
  if (!membership_tier || !membership_expires_at) {
    return res.status(400).json({ error: "membership_tier and membership_expires_at are required" });
  }
  
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ membership_tier, membership_expires_at })
    .eq("id", req.params.id)
    .select()
    .single();
    
  if (error || !data)
    return sendRowError(
      res,
      error,
      "Member not found",
      "Unable to update member tier",
    );

  return res.status(200).json({ message: "Member tier updated", member: data });
});

// PATCH /api/members/:id/role - escalate or demote an account. Admin only and
// requires a fresh password check, per the API contract.
router.patch(
  "/:id/role",
  requireAuth,
  requireRole("admin"),
  requireReauth,
  async (req, res) => {
    const result = MemberUpdateSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid role" });

    // Guard against an admin locking themselves out of the last admin seat.
    if (req.params.id === req.user!.id && result.data.role !== "admin") {
      return res
        .status(400)
        .json({ error: "You cannot remove your own admin role" });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ role: result.data.role })
      .eq("id", req.params.id)
      .select("id, full_name, role, membership_expires_at, created_at")
      .single();

    // A missing row and a rejected write are different failures; do not
    // collapse them both into 404.
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: "Member not found" });
    }

    return res
      .status(200)
      .json({ message: "Member role updated", member: data });
  },
);

export default router;