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

router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const result = ProgrammeCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created programme: ${result.data.title}`);
  res.status(201).json({
    message: "Programme created",
    programme: { id: "uuid", ...result.data },
  });
});

router.patch("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const result = ProgrammeUpdateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });
  console.log(`Updated programme ${req.params.id}`);
  res.status(200).json({ message: "Programme updated" });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  console.log(`Deleted programme ${req.params.id}`);
  res.status(204).send();
});

export default router;
