import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { isUuid, sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  ProgrammeCreateSchema,
  ProgrammeUpdateSchema,
} from "../validation/schemas";

const router = Router();

const PROGRAMME_COLUMNS =
  "id, title, description, age_range, schedule_info, image_url, active";

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("programmes")
    .select(PROGRAMME_COLUMNS)
    .eq("active", true)
    .order("title");

  if (error)
    return res.status(500).json({ error: "Unable to load programmes" });
  return res.status(200).json({ programmes: data ?? [] });
});

// GET /api/programmes/:id
// Contract: public programme detail. Like the campaign detail this also reaches
// a deactivated programme, because PATCH uses the same id and staff have to be
// able to look at what they are reactivating.
router.get("/:id", async (req, res) => {
  if (!isUuid(req.params.id))
    return res.status(404).json({ error: "Programme not found" });

  const { data, error } = await supabaseAdmin
    .from("programmes")
    .select(PROGRAMME_COLUMNS)
    .eq("id", req.params.id)
    .maybeSingle();

  if (error)
    return res.status(500).json({ error: "Unable to load programme" });
  if (!data) return res.status(404).json({ error: "Programme not found" });

  return res.status(200).json(data);
});

// Contract: programmes are written by staff and admins alike. Only the
// delete is admin-only.
router.post(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
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
  },
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
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
      return sendRowError(
        res,
        error,
        "Programme not found",
        "Unable to update programme",
      );
    return res
      .status(200)
      .json({ message: "Programme updated", programme: data });
  },
);

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
