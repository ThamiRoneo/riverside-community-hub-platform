import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [bookings, donations, members] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString()),
    supabaseAdmin
      .from("donations")
      .select("amount")
      .then(({ data, error }) => ({
        data:
          data?.reduce(
            (total, donation) => total + Number(donation.amount),
            0,
          ) ?? 0,
        error,
      })),
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["member"]),
  ]);

  if (bookings.error || donations.error || members.error)
    return res.status(500).json({ error: "Unable to generate report" });

  return res.status(200).json({
    bookings_this_month: bookings.count ?? 0,
    total_donations: donations.data,
    active_members: members.count ?? 0,
    generated_at: new Date().toISOString(),
  });
});

export default router;
