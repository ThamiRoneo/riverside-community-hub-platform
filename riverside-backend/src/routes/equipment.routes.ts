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

router.post(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = EquipmentCreateSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });
    const { data, error } = await supabaseAdmin
      .from("equipment")
      .insert(result.data)
      .select()
      .single();
    if (error)
      return res.status(500).json({ error: "Unable to create equipment" });
    return res
      .status(201)
      .json({ message: "Equipment created", equipment: data });
  },
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = EquipmentUpdateSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });
    const { data, error } = await supabaseAdmin
      .from("equipment")
      .update(result.data)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data)
      return res.status(404).json({ error: "Equipment not found" });
    return res
      .status(200)
      .json({ message: "Equipment updated", equipment: data });
  },
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const { error } = await supabaseAdmin
      .from("equipment")
      .update({ active: false })
      .eq("id", req.params.id);
    if (error)
      return res.status(500).json({ error: "Unable to deactivate equipment" });
    return res.status(204).send();
  },
);

export default router;
