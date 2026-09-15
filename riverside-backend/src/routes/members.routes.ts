import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { MemberCreateSchema, MemberUpdateSchema } from "../validation/schemas";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), (_req, res) => {
  res.status(200).json({ members: [] });
});

router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const result = MemberCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid payload" });
  console.log(`Created member: ${result.data.email}`);
  res.status(201).json({ message: "Member created", member: { id: "uuid", ...result.data } });
});

router.patch("/:id/role", requireAuth, requireRole("admin"), (req, res) => {
  const { id, role } = req.params as { id: string; role: string };
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Insufficient role" });
  console.log(`Changed role for member ${id} to ${role}`);
  res.status(200).json({ message: `Role updated for member ${id}`, memberId: id });
});

export default router;