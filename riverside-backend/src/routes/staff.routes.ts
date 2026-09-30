import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireReauth } from "../middleware/reauth";
import { requireRole } from "../middleware/roles";

const router = Router();

// GET /api/staff
// Contract grants this to admins only and defines the shape as
// {staff: [{id, full_name, role, joined_at}]}. `active` is carried alongside it
// because an admin who has just deactivated somebody needs to see that in the
// list; an extra field leaves the documented shape valid.
router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, created_at, active")
    .in("role", ["staff", "admin"])
    .order("created_at");

  if (error) return res.status(500).json({ error: "Unable to load staff" });

  return res.status(200).json({
    staff: (data ?? []).map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      joined_at: profile.created_at,
      active: profile.active,
    })),
  });
});

// PATCH /api/staff/:id/deactivate
// Contract: admin only, returns {id, active: false}, and revokes access without
// deleting history. requireReauth matches the role change, the other way an
// admin hands out or removes somebody's access. The body is empty per the
// contract, so there is nothing to validate.
router.patch(
  "/:id/deactivate",
  requireAuth,
  requireRole("admin"),
  requireReauth,
  async (req, res) => {
    // An admin who deactivates themselves loses the session they are using.
    if (req.params.id === req.user!.id)
      return res
        .status(400)
        .json({ error: "You cannot deactivate your own account" });

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, active")
      .eq("id", req.params.id)
      .single();

    if (targetError || !target)
      return res.status(404).json({ error: "Staff member not found" });

    // Already inactive: nothing to revoke, and the answer is the same shape.
    if (target.active === false)
      return res.status(200).json({ id: target.id, active: false });

    // Deactivating the last active admin would leave nobody able to undo it.
    if (target.role === "admin") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("active", true);

      if ((count ?? 0) <= 1)
        return res
          .status(400)
          .json({ error: "You cannot deactivate the last active admin" });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ active: false })
      .eq("id", req.params.id)
      .select("id, active")
      .single();

    if (error)
      return sendRowError(
        res,
        error,
        "Staff member not found",
        "Unable to deactivate staff member",
      );

    return res.status(200).json({ id: data.id, active: data.active });
  },
);

export default router;
