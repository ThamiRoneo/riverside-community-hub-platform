import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { bookingsWithin, resourceBookingsWithin } from "../lib/bookings";
import { dayBounds, overlaps } from "../lib/dates";
import { sendRowError } from "../lib/http";
import { pagination } from "../lib/pagination";
import {
  type ResourceTable,
  type ResourceType,
  listResources,
  resolveResource,
  shapeResource,
} from "../lib/resources";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import {
  ResourceCreateSchema,
  ResourceUpdateSchema,
} from "../validation/schemas";

const router = Router();

// Riverside opens at 09:00 and closes at 17:00, so a day is eight hourly
// slots. Nothing in the contract carries per-resource hours, so the grid is
// defined once here rather than repeated per slot.
const OPENING_HOUR = 9;
const CLOSING_HOUR = 17;

const TABLE_FOR: Record<ResourceType, ResourceTable> = {
  room: "facilities",
  equipment: "equipment",
};

// GET /api/resources
// Contract: public, `{type?, capacity_min?, date?, search?, page, page_size}`.
router.get("/", async (req, res) => {
  const { type, capacity_min, date, search } = req.query;

  // An unrecognised filter value is a client bug; reject it rather than
  // quietly returning the unfiltered list.
  if (type !== undefined && !["room", "equipment"].includes(String(type)))
    return res
      .status(400)
      .json({ error: "type must be one of: room, equipment" });

  let resources = (await listResources()).filter((item) => item.active);

  if (type !== undefined)
    resources = resources.filter((item) => item.type === String(type));

  if (capacity_min !== undefined) {
    const minimum = Number(capacity_min);
    if (!Number.isFinite(minimum))
      return res.status(400).json({ error: "capacity_min must be a number" });
    resources = resources.filter((item) => (item.capacity ?? 0) >= minimum);
  }

  if (search) {
    const needle = String(search).toLowerCase();
    resources = resources.filter((item) =>
      `${item.name} ${item.description ?? ""}`.toLowerCase().includes(needle),
    );
  }

  // `date` asks what is still free that day, which is a booking question rather
  // than a column on either table.
  if (date !== undefined) {
    const bounds = dayBounds(String(date));
    if (!bounds) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

    const taken = await bookingsWithin(bounds.start, bounds.end);
    resources = resources.filter((item) =>
      item.type === "room"
        ? !taken.facilityIds.has(item.id)
        : !taken.equipmentIds.has(item.id),
    );
  }

  const { pageSize, offset } = pagination(req.query);
  return res.status(200).json({
    resources: resources.slice(offset, offset + pageSize),
    total: resources.length,
  });
});

// GET /api/resources/:id
// A deactivated resource is deleted as far as the public catalogue is
// concerned, so it disappears from here as well as from the listing.
router.get("/:id", async (req, res) => {
  const resolved = await resolveResource(req.params.id);
  if (!resolved || !resolved.resource.active)
    return res.status(404).json({ error: "Resource not found" });
  return res.status(200).json(resolved.resource);
});

// GET /api/resources/:id/availability
// Contract: `{slots: [{start_time, end_time, status}]}`. A slot is unavailable
// when an approved booking overlaps any part of it, so a 09:00-10:30 booking
// blocks the 09:00 and 10:00 slots but leaves the 11:00 one open.
router.get("/:id/availability", async (req, res) => {
  const date = String(req.query.date ?? "");
  const bounds = dayBounds(date);
  if (!bounds) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

  const resolved = await resolveResource(req.params.id);
  if (!resolved) return res.status(404).json({ error: "Resource not found" });

  const booked = await resourceBookingsWithin(
    {
      facilityId: resolved.type === "room" ? resolved.resource.id : null,
      equipmentId: resolved.type === "equipment" ? resolved.resource.id : null,
    },
    bounds.start,
    bounds.end,
  );

  const slots = [];
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour++) {
    const startTime = `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
    const endTime = `${date}T${String(hour + 1).padStart(2, "0")}:00:00.000Z`;
    const taken = booked.some((booking) =>
      overlaps(startTime, endTime, booking.start_at, booking.end_at),
    );

    slots.push({
      start_time: startTime,
      end_time: endTime,
      status: taken ? "unavailable" : "available",
    });
  }

  return res.status(200).json({ slots });
});

// POST /api/resources
// `type` selects the underlying table, so a room lands in facilities and
// equipment in equipment.
router.post("/", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const result = ResourceCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { name, type, capacity, description } = result.data;
  const table = TABLE_FOR[type];

  // Equipment is tracked by quantity, so a new resource starts as one unit.
  const payload: Record<string, unknown> =
    type === "room"
      ? { name, capacity, description }
      : { name, description, quantity: 1, capacity };

  const { data, error } = await supabaseAdmin
    .from(table)
    .insert(payload)
    .select()
    .single();

  if (error) return res.status(500).json({ error: "Unable to create resource" });

  return res.status(201).json({ resource: shapeResource(table, data) });
});

// PATCH /api/resources/:id
// `type` is absent from the contract's update body, so a resource cannot be
// moved between the two tables.
router.patch(
  "/:id",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const result = ResourceUpdateSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: "Invalid payload" });

    const resolved = await resolveResource(req.params.id);
    if (!resolved) return res.status(404).json({ error: "Resource not found" });

    const { data, error } = await supabaseAdmin
      .from(resolved.table)
      .update(result.data)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error)
      return sendRowError(
        res,
        error,
        "Resource not found",
        "Unable to update resource",
      );

    return res
      .status(200)
      .json({ resource: shapeResource(resolved.table, data) });
  },
);

// DELETE /api/resources/:id
// Contract: admin only. Deactivating keeps the row and its booking history, the
// same way deactivating a profile does.
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const resolved = await resolveResource(req.params.id);
    if (!resolved) return res.status(404).json({ error: "Resource not found" });

    const { error } = await supabaseAdmin
      .from(resolved.table)
      .update({ active: false })
      .eq("id", req.params.id);

    if (error)
      return res.status(500).json({ error: "Unable to deactivate resource" });

    return res.status(204).send();
  },
);

export default router;