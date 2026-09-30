import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { csvCell, csvDocument } from "../lib/csv";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";

const router = Router();

/** Contract section 4: query {date_range, compare_with?}. */
const RANGES = ["week", "month", "quarter", "year"] as const;
type RangeName = (typeof RANGES)[number];

/** Length of each range in days. */
const RANGE_DAYS: Record<RangeName, number> = {
  week: 7,
  month: 30,
  quarter: 91,
  year: 365,
};

const BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled"];

/**
 * The window a range name covers. periodsBack shifts whole periods: 0 is the
 * current window and 1 is the one immediately before it. `now` is passed in so
 * that every window in a single response is measured from the same instant.
 *
 * "month" is the calendar month, because the contract reports
 * bookings_this_month and a rolling 30 days would not be that. The others are
 * trailing windows, which is what a range selector actually means. Snapping all
 * four to calendar month starts would make year and month identical.
 */
function period(name: RangeName, now: Date, periodsBack = 0) {
  if (name === "month") {
    return {
      from: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - periodsBack, 1),
      ),
      // A past month ends where the next one begins, so windows never overlap.
      to:
        periodsBack === 0
          ? now
          : new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - periodsBack + 1, 1),
            ),
    };
  }

  const days = RANGE_DAYS[name];
  const to = new Date(now.getTime() - periodsBack * days * 86_400_000);
  return { from: new Date(to.getTime() - days * 86_400_000), to };
}

/** Percentage change over a window, rounded to one decimal. */
function deltaPct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

interface Window {
  from: Date;
  to: Date;
}

/**
 * Validates {date_range, compare_with?} and resolves the two windows. Both the
 * summary and the export go through here so they cannot drift on which range
 * names are accepted or on where a period boundary falls.
 */
function resolveWindows(query: Record<string, unknown>) {
  const { date_range, compare_with } = query;

  if (date_range !== undefined && !RANGES.includes(date_range as RangeName))
    return { error: `date_range must be one of: ${RANGES.join(", ")}` };

  if (compare_with !== undefined && !RANGES.includes(compare_with as RangeName))
    return { error: `compare_with must be one of: ${RANGES.join(", ")}` };

  const range = (date_range as RangeName) ?? "month";
  const now = new Date();

  return {
    range,
    // Omitting compare_with compares against the equivalent window just before it.
    current: period(range, now),
    previous: period((compare_with as RangeName) ?? range, now, 1),
  };
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
  const windows = resolveWindows(req.query as Record<string, unknown>);
  if ("error" in windows) return res.status(400).json({ error: windows.error });

  const { range, current, previous } = windows;

  /**
   * The current window is left open at the top: created_at is a database
   * default, so no row can legitimately be stamped ahead of "now", and the app
   * host's clock can drift minutes from the database's. Bounding the live edge
   * with the app clock hides rows the database stamped in between the two
   * clocks disagreeing. Past windows stay closed and contiguous, so every row
   * still falls in exactly one period.
   */
  const bookingsIn = (window: Window, open: boolean) => {
    const query = supabaseAdmin
      .from("bookings")
      .select("id, status, facility_id, equipment_id, start_at, end_at, created_at")
      .gte("created_at", window.from.toISOString());
    return open ? query : query.lt("created_at", window.to.toISOString());
  };

  // Cancelled donations are withdrawn money and never counted, the same rule
  // apply_donation_to_campaign uses for campaign totals.
  const donationsIn = (window: Window, open: boolean) => {
    const query = supabaseAdmin
      .from("donations")
      .select("amount, created_at")
      .neq("status", "cancelled")
      .gte("created_at", window.from.toISOString());
    return open ? query : query.lt("created_at", window.to.toISOString());
  };

  const membersJoinedIn = (window: Window, open: boolean) => {
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
  const byMonth = RANGE_DAYS[range] > 31;
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

/** PostgREST embeds a many-to-one relation as an object, an array, or null. */
function embeddedName(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as { name?: string })?.name ?? null;
  if (value && typeof value === "object")
    return (value as { name?: string }).name ?? null;
  return null;
}

// GET /api/reports/export
// The contract grants this to admins only and says it takes the same filters as
// the summary, so it streams the underlying rows for the window rather than the
// summary's own figures. Bookings and donations share one sheet, told apart by
// record_type, because a hub manager wants one file to open.
const EXPORT_COLUMNS = [
  "record_type",
  "id",
  "created_at",
  "status",
  "person_id",
  "resource",
  "start_at",
  "end_at",
  "amount",
  "type",
  "receipt_reference",
  "staff_note",
];

router.get(
  "/export",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const windows = resolveWindows(req.query as Record<string, unknown>);
    if ("error" in windows) return res.status(400).json({ error: windows.error });

    const { range, current } = windows;

    const [bookings, donations] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select(
          "id, status, member_id, start_at, end_at, staff_note, created_at, facilities(name), equipment(name)",
        )
        .gte("created_at", current.from.toISOString())
        .order("created_at"),
      supabaseAdmin
        .from("donations")
        .select(
          "id, status, donor_id, amount, type, receipt_reference, staff_note, created_at, anonymous, donor_name, donor_email, donor_phone, campaigns(title)",
        )
        .neq("status", "cancelled")
        .gte("created_at", current.from.toISOString())
        .order("created_at"),
    ]);

    if (bookings.error || donations.error)
      return res.status(500).json({ error: "Unable to export the report" });

    const records: Record<string, unknown>[] = [];

    for (const booking of bookings.data ?? []) {
      records.push({
        record_type: "booking",
        id: booking.id,
        created_at: booking.created_at,
        status: booking.status,
        person_id: booking.member_id,
        resource: embeddedName(booking.facilities) ?? embeddedName(booking.equipment),
        start_at: booking.start_at,
        end_at: booking.end_at,
        amount: null,
        type: null,
        receipt_reference: null,
        staff_note: booking.staff_note,
      });
    }

    for (const donation of donations.data ?? []) {
      // An anonymous donor is identified by nothing, including the profile id,
      // which would otherwise point straight back at their record.
      const anonymous = Boolean(donation.anonymous);
      records.push({
        record_type: "donation",
        id: donation.id,
        created_at: donation.created_at,
        status: donation.status,
        person_id: anonymous ? null : donation.donor_id,
        resource: embeddedName(donation.campaigns),
        start_at: null,
        end_at: null,
        amount: donation.amount,
        type: donation.type,
        receipt_reference: donation.receipt_reference,
        staff_note: donation.staff_note,
      });
    }

    records.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    return res
      .status(200)
      .send(
        csvDocument(
          EXPORT_COLUMNS,
          records.map((record) =>
            EXPORT_COLUMNS.map((column) => csvCell(record[column])).join(","),
          ),
        ),
      );
  },
);

export default router;
