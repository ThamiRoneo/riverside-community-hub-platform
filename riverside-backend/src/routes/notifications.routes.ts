import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, booking_id, message, read, created_at")
    .eq("user_id", req.user?.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error)
    return res.status(500).json({ error: "Unable to load notifications" });
  return res.status(200).json({ notifications: data ?? [] });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("id", req.params.id)
    .eq("user_id", req.user?.id)
    .select("id, read")
    .single();

  if (error || !data)
    return res.status(404).json({ error: "Notification not found" });
  return res.status(200).json({ notification: data });
});

export default router;
