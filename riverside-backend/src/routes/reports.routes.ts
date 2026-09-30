import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

/** Contract section 4: query {date_range, compare_with?}. */
const RANGES = ["week", "month", "quarter", "year"] as const;
type RangeName = (typeof RANGES)[number];

/**
 * Months each range covers. "month" is 0 here only because it is a calendar
 * month, which needs different arithmetic from the rolling windows; the others
 * are simply N months back from now.
 */
const RANGE_MONTHS: Record<RangeName, number> = {
  week: 0,
  month: 1,
  quarter: 3,
  year: 12,
};

const BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled"];

/**
 * The window a range name covers. periodsBack shifts whole periods: 0 is the
 * current window and 1 is the one immediately before it. `now` is passed in so
 * that every window in a single response is measured from the same instant.
 */
function period(name: RangeName, now: Date, periodsBack = 0) {
  if (RANGE_MONTHS[name] === 0) {
    const to = new Date(now.getTime() - periodsBack * 7 * 86_400_000);
    return { from: new Date(to.getTime() - 7 * 86_400_000), to };
  }

  const months = RANGE_MONTHS[name];
  const startOf = (back: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months * back, 1));

  return {
    from: startOf(periodsBack),
    // A past period ends where the following one begins, so windows never overlap.
    to: periodsBack === 0 ? now : startOf(periodsBack - 1),
  };
}

/** Percentage change over a window, rounded to one decimal. */
function deltaPct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

interface BookingRow {
  id: string;
  status: string;
  facility_id: string | null;
  equipment_id: string | null;
  start_at: string;
  end_at: string;
}

/**
 * Bookings that overlap another live booking on the same resource. The database
 * already refuses two overlapping *approved* bookings, but several pending
 * requests can legitimately collide in the queue, and staff need to see that
 * before approving one.
 *
 * ponytail: pairwise within each resource group, so O(n^2) over a date-bounded
 * window. Fine for one hub's queue; sort by start_at and sweep if that grows.
 */
function countConflicts(bookings: BookingRow[]) {
  const byResource = new Map<string, BookingRow[]>();

  for (const booking of bookings) {
    if (booking.status === "cancelled") continue;
    const key = booking.facility_id
      ? `facility:${booking.facility_id}`
      : booking.equipment_id
        ? `equipment:${booking.equipment_id}`
        : null;
    if (!key) continue;
    byResource.set(key, [...(byResource.get(key) ?? []), booking]);
  }

  let conflicts = 0;
  for (const group of byResource.values()) {
    for (const booking of group) {
      const overlaps = group.some(
        (other) =>
          other.id !== booking.id &&
          booking.start_at < other.end_at &&
          other.start_at < booking.end_at,
      );
      if (overlaps) conflicts++;
    }
  }
  return conflicts;
}

// GET /api/reports/summary
// Contract grants this to staff and admins alike; it was previously
// admin-only, which locked staff out of the dashboard summary.
router.get("/summary", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const { date_range, compare_with } = req.query;

  if (date_range !== undefined && !RANGES.includes(date_range as RangeName))
    return res
      .status(400)
      .json({ error: `date_range must be one of: ${RANGES.join(", ")}` });

  if (compare_with !== undefined && !RANGES.includes(compare_with as RangeName))
    return res
      .status(400)
      .json({ error: `compare_with must be one of: ${RANGES.join(", ")}` });

  const range = (date_range as RangeName) ?? "month";
  // Omitting compare_with compares against the equivalent window just before it.
  const now = new Date();
  const current = period(range, now);
  const previous = period((compare_with as RangeName) ?? range, now, 1);

  /**
   * The current window is left open at the top: created_at is a database
   * default, so no row can legitimately be stamped ahead of "now", and the app
   * host's clock can drift minutes from the database's. Bounding the live edge
   * with the app clock hides rows the database stamped in between the two
   * clocks disagreeing. Past windows stay closed and contiguous, so every row
   * still falls in exactly one period.
   */
  const bookingsIn = (window: { from: Date; to: Date }, open: boolean) => {
    const query = supabaseAdmin
      .from("bookings")
      .select("id, status, facility_id, equipment_id, start_at, end_at, created_at")
      .gte("created_at", window.from.toISOString());
    return open ? query : query.lt("created_at", window.to.toISOString());
  };

  // Cancelled donations are withdrawn money and never counted, the same rule
  // apply_donation_to_campaign uses for campaign totals.
  const donationsIn = (window: { from: Date; to: Date }, open: boolean) => {
    const query = supabaseAdmin
      .from("donations")
      .select("amount, created_at")
      .neq("status", "cancelled")
      .gte("created_at", window.from.toISOString());
    return open ? query : query.lt("created_at", window.to.toISOString());
  };

  const membersJoinedIn = (window: { from: Date; to: Date }, open: boolean) => {
    const query = supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "member")
      .gte("created_at", window.from.toISOString());
    return open ? query : query.lt("created_at", window.to.toISOString());
  };

  const [bookings, donations, members, newMembers, prevBookings, prevDonations, prevMembers] =
    await Promise.all([
      bookingsIn(current, true),
      donationsIn(current, true),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "member"),
      membersJoinedIn(current, true),
      bookingsIn(previous, false),
      donationsIn(previous, false),
      membersJoinedIn(previous, false),
    ]);

  const failed = [bookings, donations, members, newMembers, prevBookings, prevDonations, prevMembers]
    .filter((result) => result.error)
    .map((result) => result.error);
  if (failed.length)
    return res.status(500).json({ error: "Unable to generate report" });

  const bookingRows: BookingRow[] = bookings.data ?? [];
  const donationRows = donations.data ?? [];
  const prevBookingCount = (prevBookings.data ?? []).length;
  const prevDonationTotal = (prevDonations.data ?? []).reduce(
    (total, donation) => total + Number(donation.amount),
    0,
  );

  const bookingsByStatus = BOOKING_STATUSES.map((status) => ({
    status,
    count: bookingRows.filter((booking) => booking.status === status).length,
  }));

  // Day buckets read as a trend over a month; month buckets keep a year legible.
  const byMonth = RANGE_MONTHS[range] > 1;
  const buckets = new Map<string, { total: number; count: number }>();
  for (const donation of donationRows) {
    const key = donation.created_at.slice(0, byMonth ? 7 : 10);
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += Number(donation.amount);
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  const donationsOverTime = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({ date, total: bucket.total, count: bucket.count }));

  const donationsTotal = donationRows.reduce(
    (total, donation) => total + Number(donation.amount),
    0,
  );

  return res.status(200).json({
    bookings_this_month: bookingRows.length,
    bookings_delta_pct: deltaPct(bookingRows.length, prevBookingCount),
    donations_total: donationsTotal,
    donations_delta_pct: deltaPct(donationsTotal, prevDonationTotal),
    active_members: members.count ?? 0,
    active_members_delta: (newMembers.count ?? 0) - (prevMembers.count ?? 0),
    pending_requests: bookingRows.filter((booking) => booking.status === "pending").length,
    conflict_count: countConflicts(bookingRows),
    bookings_by_status: bookingsByStatus,
    donations_over_time: donationsOverTime,
    generated_at: new Date().toISOString(),
  });
});

export default router;
