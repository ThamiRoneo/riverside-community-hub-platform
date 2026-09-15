import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { DonationCreateSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  res.status(200).json({ donations: [] });
});

router.post("/", requireAuth, (req, res) => {
  const result = DonationCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created donation: campaign=${result.data.campaign_id}, amount=${result.data.amount}`);
  res.status(201).json({ message: "Donation created", donation: { id: "uuid", ...result.data } });
});

router.patch("/:id/follow-up", requireAuth, (req, res) => {
  const { staff_note } = req.body as { staff_note: string };
  if (!staff_note) return res.status(400).json({ error: "staff_note is required for follow-up" });
  console.log(`Follow-up on donation ${req.params.id}`);
  res.status(200).json({ message: "Donation follow-up completed", donationId: req.params.id });
});

export default router;
