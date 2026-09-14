import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get("/members", requireAuth, requireRole("staff", "admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/members/:id/role", requireAuth, requireRole("admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented — pending re-auth check" });
});

export default router;
