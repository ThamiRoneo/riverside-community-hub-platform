import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  CampaignCreateSchema,
  CampaignUpdateSchema,
} from "../validation/schemas";

const router = Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, description, goal_amount, current_amount, active")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Unable to load campaigns" });
  return res.status(200).json({ campaigns: data ?? [] });
});

router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const result = CampaignCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created campaign: ${result.data.title}`);
  res.status(201).json({
    message: "Campaign created",
    campaign: { id: "uuid", ...result.data },
  });
});

router.patch("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const result = CampaignUpdateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  console.log(`Updated campaign ${req.params.id}`);
  res.status(200).json({ message: "Campaign updated" });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  console.log(`Deleted campaign ${req.params.id}`);
  res.status(204).send();
});

export default router;
