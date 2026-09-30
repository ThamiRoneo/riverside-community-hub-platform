import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireReauth } from "../middleware/reauth";
import { requireRole } from "../middleware/roles";
import { StaffInviteSchema } from "../validation/schemas";

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

// POST /api/staff/invite
// Contract: admin only, returns {invite_id, status}. Plain signup is left to the
// auth trigger, which gives everybody "member". An invite is different: the
// admin already knows the access level they are granting, so the role travels
// with the invite and is written onto the profile the trigger creates.
// requireReauth matches PATCH /:id/deactivate; both hand out or remove access.
router.post(
  "/invite",
  requireAuth,
  requireRole("admin"),
  requireReauth,
  async (req, res) => {
    const result = StaffInviteSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });

    const { email, role } = result.data;

    const { data: invite, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      // GoTrue reports an address that is already registered as a client error;
      // that is a conflict rather than an upstream outage.
      const alreadyRegistered =
        /already (been )?registered|already exists/i.test(inviteError.message);
      if (alreadyRegistered)
        return res
          .status(409)
          .json({ error: "That email already has an account" });
      return res.status(502).json({ error: "Unable to send the invite" });
    }

    // The trigger has already created the profile as a member by now; overwrite
    // it with the role the admin chose.
    const { data: profile, error: roleError } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", invite.user.id)
      .select("id")
      .single();

    if (roleError || !profile) {
      // Deleting the auth user cascades to the profile, so a failed role write
      // must not leave a half-invited account behind.
      await supabaseAdmin.auth.admin.deleteUser(invite.user.id);
      return res.status(500).json({ error: "Unable to assign the invited role" });
    }

    return res
      .status(201)
      .json({ invite_id: invite.user.id, status: "pending" });
  },
);

export default router;
