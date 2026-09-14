import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

router.use(requireAuth, requireRole("admin", "staff"));

router.get("/reports", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/resources", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/programmes", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/staff", requireRole("admin"), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
