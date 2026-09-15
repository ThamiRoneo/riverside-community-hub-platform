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

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const result = CampaignCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .insert(result.data)
    .select()
    .single();
  if (error)
    return res.status(500).json({ error: "Unable to create campaign" });
  return res.status(201).json({ message: "Campaign created", campaign: data });
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const result = CampaignUpdateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .update(result.data)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data)
    return res.status(404).json({ error: "Campaign not found" });
  return res.status(200).json({ message: "Campaign updated", campaign: data });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { error } = await supabaseAdmin
    .from("campaigns")
    .delete()
    .eq("id", req.params.id);
  if (error)
    return res.status(500).json({ error: "Unable to delete campaign" });
  return res.status(204).send();
});

export default router;
