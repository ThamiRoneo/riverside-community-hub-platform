import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { FacilityCreateSchema, FacilityUpdateSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  res.status(200).json({ facilities: [] });
});

router.post("/", requireAuth, requireRole("staff", "admin"), (req, res) => {
  const result = FacilityCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created facility: ${result.data.name}`);
  res.status(201).json({ message: "Facility created", facility: { id: "uuid", ...result.data } });
});

router.patch("/:id", requireAuth, requireRole("staff", "admin"), (req, res) => {
  const result = FacilityUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Updated facility ${req.params.id}`);
  res.status(200).json({ message: "Facility updated" });
});

router.delete("/:id", requireAuth, requireRole("staff", "admin"), (req, res) => {
  console.log(`Deleted facility ${req.params.id}`);
  res.status(204).send();
});

export default router;
