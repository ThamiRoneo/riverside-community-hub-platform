import { Router } from "express";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

router.get("/campaigns", attachUserIfPresent, (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/", attachUserIfPresent, (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/", requireAuth, requireRole("staff", "admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/:id/follow-up", requireAuth, requireRole("staff", "admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
