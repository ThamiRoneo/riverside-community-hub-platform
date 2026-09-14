import { Router } from "express";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

router.get("/resources", attachUserIfPresent, (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/", requireAuth, (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/", requireAuth, requireRole("member", "staff", "admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/:id/approve", requireAuth, requireRole("staff", "admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/:id/reject", requireAuth, requireRole("staff", "admin"), (req, res) => {
  if (!req.body?.staff_note) {
    return res.status(400).json({ error: "staff_note is required" });
  }
  res.status(501).json({ error: "Not implemented" });
});

export default router;
