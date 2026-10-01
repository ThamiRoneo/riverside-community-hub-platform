import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireUuidParam } from "../middleware/params";

const router = Router();

const NOTIFICATION_COLUMNS = "id, booking_id, message, read, created_at";

router.get("/", requireAuth, async (req, res) => {
  const { unread_only, page, page_size } = req.query;

  if (unread_only !== undefined && unread_only !== "true") {
    return res.status(400).json({ error: "unread_only must be 'true'" });
  }

  const pageNum = Math.max(1, parseInt(String(page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(page_size ?? "10"), 10) || 10),
  );
  const offset = (pageNum - 1) * pageSize;

  let query = supabaseAdmin
    .from("notifications")
    .select(NOTIFICATION_COLUMNS, { count: "exact" })
    .eq("user_id", req.user!.id);

  if (unread_only === "true") {
    query = query.eq("read", false);
  }

  const { data, error, count } = await query
    .range(offset, offset + pageSize - 1)
    .order("created_at", { ascending: false });

  if (error)
    return res.status(500).json({ error: "Unable to load notifications" });

  return res.status(200).json({
    notifications: data ?? [],
    total: count ?? 0,
    page: pageNum,
    page_size: pageSize,
  });
});

router.patch("/:id/read", requireAuth, requireUuidParam, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("id", req.params.id)
    .eq("user_id", req.user!.id)
    .select("id, read")
    .single();

  if (error || !data)
    return sendRowError(
      res,
      error,
      "Notification not found",
      "Unable to mark notification read",
    );
  return res.status(200).json({ id: data.id, read: data.read });
});

export default router;
