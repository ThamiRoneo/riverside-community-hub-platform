import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  EquipmentCreateSchema,
  EquipmentUpdateSchema,
} from "../validation/schemas";

const router = Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("equipment")
    .select("id, name, description, quantity, active")
    .eq("active", true)
    .order("name");

  if (error) return res.status(500).json({ error: "Unable to load equipment" });
  return res.status(200).json({ equipment: data ?? [] });
});

router.post("/", requireAuth, requireRole("staff", "admin"), (req, res) => {
  const result = EquipmentCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created equipment: ${result.data.name}`);
  res.status(201).json({
    message: "Equipment created",
    equipment: { id: "uuid", ...result.data },
  });
});

router.patch("/:id", requireAuth, requireRole("staff", "admin"), (req, res) => {
  const result = EquipmentUpdateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  console.log(`Updated equipment ${req.params.id}`);
  res.status(200).json({ message: "Equipment updated" });
});

router.delete(
  "/:id",
  requireAuth,
  requireRole("staff", "admin"),
  (req, res) => {
    console.log(`Deleted equipment ${req.params.id}`);
    res.status(204).send();
  },
);

export default router;
