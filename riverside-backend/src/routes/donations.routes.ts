import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { DonationCreateSchema } from "../validation/schemas";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("donations")
      .select(
        "id, campaign_id, donor_id, amount, type, status, donor_name, donor_email, donor_phone, anonymous, receipt_opt_in, staff_note, created_at, campaigns(title)",
      )
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Unable to load donations" });
    return res.status(200).json({ donations: data ?? [] });
  },
);

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

router.patch(
  "/:id/follow-up",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const { staff_note } = req.body as { staff_note: string };
    if (!staff_note)
      return res
        .status(400)
        .json({ error: "staff_note is required for follow-up" });
    const { data, error } = await supabaseAdmin
      .from("donations")
      .update({ status: "followed_up", staff_note })
      .eq("id", req.params.id)
      .select("id, status, staff_note")
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Donation not found" });
    return res.status(200).json({
      message: "Donation follow-up completed",
      donation: data,
    });
  },
);

export default router;
