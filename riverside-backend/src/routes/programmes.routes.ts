import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  ProgrammeCreateSchema,
  ProgrammeUpdateSchema,
} from "../validation/schemas";

const router = Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("programmes")
    .select(
      "id, title, description, age_range, schedule_info, image_url, active",
    )
    .eq("active", true)
    .order("title");

  if (error)
    return res.status(500).json({ error: "Unable to load programmes" });
  return res.status(200).json({ programmes: data ?? [] });
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const result = ProgrammeCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  const { data, error } = await supabaseAdmin
    .from("programmes")
    .insert(result.data)
    .select()
    .single();
  if (error)
    return res.status(500).json({ error: "Unable to create programme" });
  return res
    .status(201)
    .json({ message: "Programme created", programme: data });
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const result = ProgrammeUpdateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  const { data, error } = await supabaseAdmin
    .from("programmes")
    .update(result.data)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data)
    return res.status(404).json({ error: "Programme not found" });
  return res
    .status(200)
    .json({ message: "Programme updated", programme: data });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { error } = await supabaseAdmin
    .from("programmes")
    .delete()
    .eq("id", req.params.id);
  if (error)
    return res.status(500).json({ error: "Unable to delete programme" });
  return res.status(204).send();
});

export default router;
