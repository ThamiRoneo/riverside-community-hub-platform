import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  CampaignCreateSchema,
  CampaignUpdateSchema,
} from "../validation/schemas";

const router = Router();

const CAMPAIGN_COLUMNS =
  "id, title, description, goal_amount, current_amount, active, created_at";

/**
 * The campaign wire shape. Four endpoints return campaigns, so the percentage
 * is derived once here rather than written out at each call site.
 *
 * A campaign with no goal reports null rather than 0: "0% funded" claims a goal
 * of zero, which is a different statement from "no goal was set". A zero goal is
 * impossible through the schema but is still guarded, because it divides by zero.
 */
function withProgress<T extends { goal_amount: unknown; current_amount: unknown }>(
  campaign: T,
) {
  const goal = Number(campaign.goal_amount);
  const raised = Number(campaign.current_amount);

  return {
    ...campaign,
    progress_pct:
      Number.isFinite(goal) && goal > 0 && Number.isFinite(raised)
        ? Math.round((raised / goal) * 100)
        : null,
  };
}

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Unable to load campaigns" });
  return res
    .status(200)
    .json({ campaigns: (data ?? []).map((row) => withProgress(row)) });
});

// GET /api/campaigns/:id
// Contract: public single-campaign detail. Unlike the listing this also reaches
// a deactivated campaign, because PATCH uses the same id and an admin has to be
// able to look at what they are reactivating.
router.get("/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", req.params.id)
    .maybeSingle();

  if (error)
    return res.status(500).json({ error: "Unable to load campaign" });
  if (!data) return res.status(404).json({ error: "Campaign not found" });

  return res.status(200).json(withProgress(data));
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
  return res
    .status(201)
    .json({ message: "Campaign created", campaign: withProgress(data) });
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
    return sendRowError(
      res,
      error,
      "Campaign not found",
      "Unable to update campaign",
    );
  return res
    .status(200)
    .json({ message: "Campaign updated", campaign: withProgress(data) });
});

export default router;
