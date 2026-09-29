import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { requireReauth } from "../middleware/reauth";
import { MemberCreateSchema, MemberUpdateSchema } from "../validation/schemas";

const router = Router();

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
router.get("/:id", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", req.params.id)
    .single();
    
  if (error || !data) return res.status(404).json({ error: "Member not found" });
  
  return res.status(200).json(data);
});


router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const result = MemberCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: result.data.email,
    password: result.data.password,
    email_confirm: false,
    user_metadata: { full_name: result.data.full_name },
  });

  if (error) return res.status(400).json({ error: error.message });
  if (!data.user)
    return res.status(500).json({ error: "Unable to create member" });

  // createUser fires the on_auth_user_created trigger, so the profile row
  // already exists. Upsert fills in the admin-supplied defaults instead of
  // colliding with that row's primary key.
  const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: data.user.id,
      full_name: result.data.full_name,
      membership_expires_at: expiration,
      role: "member",
      phone: null,
      membership_tier: "free",
    },
    { onConflict: "id" },
  );

  // Silently swallowing this would report a member that was never set up.
  if (profileError) {
    return res.status(500).json({ error: "Unable to create member profile" });
  }

  return res.status(201).json({
    message: "Member created",
    member: {
      id: data.user.id,
      email: data.user.email,
      full_name: result.data.full_name,
      role: "member",
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
    
  if (error || !data) return res.status(404).json({ error: "Member not found" });
  
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

// PATCH /members/:id/renewal - renew membership (admin only)
router.patch(
  "/:id/renewal",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    
    const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ membership_expires_at: expiration })
      .eq("id", req.params.id)
      .select("id, full_name, membership_expires_at")
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Member not found" });

    return res
      .status(200)
      .json({ message: "Membership renewed for 30 days", member: data });
  },
);


export default router;