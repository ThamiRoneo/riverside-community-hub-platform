import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { CampaignCreateSchema, CampaignUpdateSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, requireRole("staff", "admin"), (_req, res) => {
  res.status(200).json({ campaigns: [] });
});

router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const result = CampaignCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created campaign: ${result.data.title}`);
  res.status(201).json({ message: "Campaign created", campaign: { id: "uuid", ...result.data } });
});

router.patch("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const result = CampaignUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Updated campaign ${req.params.id}`);
  res.status(200).json({ message: "Campaign updated" });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  console.log(`Deleted campaign ${req.params.id}`);
  res.status(204).send();
});

export default router;
