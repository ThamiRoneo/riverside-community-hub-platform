import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { MemberCreateSchema, MemberUpdateSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, membership_expires_at, created_at")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Unable to load members" });
  return res.status(200).json({ members: data ?? [] });
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

router.patch(
  "/:id/role",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const result = MemberUpdateSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Invalid role" });

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ role: result.data.role })
      .eq("id", req.params.id)
      .select("id, full_name, role, membership_expires_at, created_at")
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Member not found" });
    return res
      .status(200)
      .json({ message: "Member role updated", member: data });
  },
);

export default router;
