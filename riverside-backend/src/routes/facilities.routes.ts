import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  FacilityCreateSchema,
  FacilityUpdateSchema,
} from "../validation/schemas";

const router = Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("facilities")
    .select("id, name, description, capacity, hourly_rate, active")
    .eq("active", true)
    .order("name");

  if (error)
    return res.status(500).json({ error: "Unable to load facilities" });
  return res.status(200).json({ facilities: data ?? [] });
});

router.post(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = FacilityCreateSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });
    const { data, error } = await supabaseAdmin
      .from("facilities")
      .insert(result.data)
      .select()
      .single();
    if (error)
      return res.status(500).json({ error: "Unable to create facility" });
    return res
      .status(201)
      .json({ message: "Facility created", facility: data });
  },
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = FacilityUpdateSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });
    const { data, error } = await supabaseAdmin
      .from("facilities")
      .update(result.data)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data)
      return sendRowError(
        res,
        error,
        "Facility not found",
        "Unable to update facility",
      );
    return res
      .status(200)
      .json({ message: "Facility updated", facility: data });
  },
);

// Contract: DELETE /api/resources/:id is admin only. Staff may create and
// edit resources, but deactivating one removes it from public booking.
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const { error } = await supabaseAdmin
      .from("facilities")
      .update({ active: false })
      .eq("id", req.params.id);
    if (error)
      return res.status(500).json({ error: "Unable to deactivate facility" });
    return res.status(204).send();
  },
);

export default router;
