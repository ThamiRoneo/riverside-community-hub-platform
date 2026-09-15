import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { BookingCreateSchema, BookingApproveSchema, BookingRejectSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), (_req, res) => {
  res.status(200).json({ bookings: [] });
});

router.post("/", requireAuth, (req, res) => {
  const result = BookingCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  const { facility_id, equipment_id, start_at, end_at } = result.data;
  console.log(`Creating booking: ${facility_id}/${equipment_id} ${start_at}-${end_at}`);
  res.status(201).json({ message: "Booking created", booking: { id: "uuid", facility_id, equipment_id, start_at, end_at } });
});

router.patch("/:id/approve", requireAuth, requireRole("staff"), (req, res) => {
  const result = BookingApproveSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Approved booking ${req.params.id}`);
  res.status(200).json({ message: `Booking ${req.params.id} approved` });
});

router.patch("/:id/reject", requireAuth, requireRole("staff"), (req, res) => {
  const result = BookingRejectSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Rejected booking ${req.params.id}`);
  res.status(200).json({ message: `Booking ${req.params.id} rejected` });
});

export default router;
