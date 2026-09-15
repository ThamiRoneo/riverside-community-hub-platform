import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { DonationCreateSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  res.status(200).json({ donations: [] });
});

router.post("/", attachUserIfPresent, async (req, res) => {
  const result = DonationCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { data, error } = await supabaseAdmin
    .from("donations")
    .insert({
      ...result.data,
      donor_id: req.user?.id ?? null,
    })
    .select(
      "id, campaign_id, amount, type, anonymous, receipt_opt_in, created_at",
    )
    .single();

  if (error)
    return res.status(500).json({ error: "Unable to create donation" });
  return res.status(201).json({ message: "Donation created", donation: data });
});

router.patch("/:id/follow-up", requireAuth, (req, res) => {
  const { staff_note } = req.body as { staff_note: string };
  if (!staff_note)
    return res
      .status(400)
      .json({ error: "staff_note is required for follow-up" });
  console.log(`Follow-up on donation ${req.params.id}`);
  res
    .status(200)
    .json({
      message: "Donation follow-up completed",
      donationId: req.params.id,
    });
});

export default router;
