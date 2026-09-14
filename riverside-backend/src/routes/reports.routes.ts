import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const { week_number } = req.query;
  const week = week_number ? parseInt(week_number as string) : 5;
  console.log(`Generated report for week ${week}`);
  res.status(200).json({ week, summary: "Week 5 report", date: new Date().toISOString() });
});

export default router;
