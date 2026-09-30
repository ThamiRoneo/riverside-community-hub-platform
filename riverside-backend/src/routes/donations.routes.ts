import crypto from "node:crypto";
import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { csvCell, csvDocument } from "../lib/csv";
import { pagination } from "../lib/pagination";
import { isForeignKeyViolation, sendRowError } from "../lib/http";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { DonationCreateSchema } from "../validation/schemas";

const router = Router();

// Must stay in sync with the public.donation_type and public.donation_status
// enums as reconciled in migration 0005.
const DONATION_TYPES = ["one_off", "pledge_intent"];
const DONATION_STATUSES = [
  "paid",
  "pending_followup",
  "followed_up",
  "cancelled",
];

/** An anonymous donation must not expose the donor's identity in an export. */
function redactAnonymous(donation: Record<string, unknown>) {
  if (!donation.anonymous) return donation;
  return { ...donation, donor_name: null, donor_email: null, donor_phone: null };
}

const LIST_COLUMNS =
  "id, campaign_id, donor_id, amount, type, status, donor_name, donor_email, " +
  "donor_phone, anonymous, receipt_opt_in, receipt_reference, staff_note, " +
  "created_at, campaigns(title)";

/**
 * The slice of a PostgREST builder these filters need. Declared structurally so
 * the shared helper serves both endpoints; returning `any` from each method
 * keeps TypeScript from walking the generated database types through the
 * filter chain, which it does to death on a generic that preserves the type.
 */
interface Filterable {
  eq(column: string, value: unknown): any;
  gte(column: string, value: string): any;
  lte(column: string, value: string): any;
  range(from: number, to: number): any;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `date_to` is inclusive, so a bare date covers the whole day rather than
 * stopping at midnight and hiding everything after it.
 */
function endOfDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

/**
 * The filters the contract gives both donation endpoints, or null when a value
 * cannot match the column. Silently dropping an unusable filter would answer
 * with rows the caller did not ask for, which is worse than telling them.
 */
function donationFilterError(query: Record<string, unknown>): string | null {
  const { campaign_id, type, status, date_from, date_to } = query;

  if (type !== undefined && !DONATION_TYPES.includes(String(type)))
    return `type must be one of: ${DONATION_TYPES.join(", ")}`;
  if (status !== undefined && !DONATION_STATUSES.includes(String(status)))
    return `status must be one of: ${DONATION_STATUSES.join(", ")}`;
  if (campaign_id !== undefined && !UUID_PATTERN.test(String(campaign_id)))
    return "campaign_id must be a uuid";
  for (const [name, value] of [
    ["date_from", date_from],
    ["date_to", date_to],
  ] as const) {
    if (value !== undefined && Number.isNaN(Date.parse(String(value))))
      return `${name} must be an ISO date`;
  }
  if (date_from !== undefined && date_to !== undefined) {
    if (Date.parse(endOfDay(String(date_to))) < Date.parse(String(date_from)))
      return "date_to must not be before date_from";
  }

  return null;
}

function applyDonationFilters<T extends Filterable>(
  builder: T,
  query: Record<string, unknown>,
): T {
  const { campaign_id, type, status, date_from, date_to } = query;
  let next: any = builder;

  if (campaign_id !== undefined) next = next.eq("campaign_id", String(campaign_id));
  if (type !== undefined) next = next.eq("type", String(type));
  if (status !== undefined) next = next.eq("status", String(status));
  if (date_from !== undefined) next = next.gte("created_at", String(date_from));
  if (date_to !== undefined) next = next.lte("created_at", endOfDay(String(date_to)));

  return next as T;
}

// GET /api/donations
// Contract: staff and admin, filterable by campaign, type, status and date, and
// paginated. `status=pending_followup` is the follow-up queue.
router.get(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const filterError = donationFilterError(req.query);
    if (filterError) return res.status(400).json({ error: filterError });

    const { page, pageSize, offset } = pagination(req.query);

    // The builder is bound to a const first: inferring its generated type
    // through the filter helper's generic makes TypeScript give up with an
    // excessively-deep-instantiation error.
    const builder = supabaseAdmin
      .from("donations")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false });

    const { data, error, count } = await applyDonationFilters(
      builder,
      req.query,
    ).range(offset, offset + pageSize - 1);

    if (error)
      return res.status(500).json({ error: "Unable to load donations" });
    return res.status(200).json({
      donations: data ?? [],
      total: count ?? 0,
      page,
      page_size: pageSize,
    });
  },
);

// GET /api/donations/export
// Contract restricts the full donor export to admins. Staff keep the
// filtered JSON list but not the identifying CSV.
router.get(
  "/export",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    // The contract gives the export the same filters as the list, and an export
    // is never paginated: it must contain every matching row.
    const filterError = donationFilterError(req.query);
    if (filterError) return res.status(400).json({ error: filterError });

    const builder = supabaseAdmin
      .from("donations")
      .select(
        "id, campaign_id, amount, type, status, donor_name, donor_email, donor_phone, anonymous, receipt_opt_in, staff_note, created_at",
      )
      .order("created_at", { ascending: false });

    const { data, error } = await applyDonationFilters(builder, req.query);

    if (error)
      return res.status(500).json({ error: "Unable to export donations" });

    const columns = [
      "id",
      "campaign_id",
      "amount",
      "type",
      "status",
      "donor_name",
      "donor_email",
      "donor_phone",
      "anonymous",
      "receipt_opt_in",
      "staff_note",
      "created_at",
    ];
    const rows = (data ?? []).map((donation) => {
      const safe = redactAnonymous(donation as Record<string, unknown>);
      return columns
        .map((column) => csvCell(safe[column as keyof typeof donation]))
        .join(",");
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=donations.csv");
    return res.status(200).send(csvDocument(columns, rows));
  },
);

/**
 * Reference returned to a donor in the POST response. Minted once on insert
 * so it is stable and unique.
 */
function mintReceiptReference(): string {
  const year = new Date().getUTCFullYear();
  return `RCH-${year}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// POST /api/donations
// Contract: one_off settles immediately as "paid"; a pledge_intent is a promise
// to give and lands in the staff follow-up queue as "pending_followup".
router.post("/", attachUserIfPresent, async (req, res) => {
  const result = DonationCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { type } = result.data;
  const status = type === "pledge_intent" ? "pending_followup" : "paid";

  const { data, error } = await supabaseAdmin
    .from("donations")
    .insert({
      ...result.data,
      status,
      receipt_reference: mintReceiptReference(),
      donor_id: req.user?.id ?? null,
    })
    .select("id, status, receipt_reference")
    .single();

  // A campaign that does not exist is a client error, not a server fault.
  if (isForeignKeyViolation(error))
    return res
      .status(404)
      .json({ error: "Campaign not found for this donation" });
  if (error)
    return res.status(500).json({ error: "Unable to create donation" });

  return res.status(201).json(data);
});

// PATCH /api/donations/:id/follow-up
// Contract: staff_note is optional, the transition is only valid from
// pending_followup, and anything else is a 409.
router.patch(
  "/:id/follow-up",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const { staff_note } = req.body as { staff_note?: string };

    const { data: donation, error: lookupError } = await supabaseAdmin
      .from("donations")
      .select("id, status")
      .eq("id", req.params.id)
      .single();

    if (lookupError || !donation)
      return sendRowError(
        res,
        lookupError,
        "Donation not found",
        "Unable to load donation",
      );

    if (donation.status !== "pending_followup")
      return res.status(409).json({
        error: `A ${donation.status} donation cannot be followed up`,
      });

    const { data, error } = await supabaseAdmin
      .from("donations")
      .update({
        status: "followed_up",
        ...(staff_note ? { staff_note } : {}),
      })
      .eq("id", req.params.id)
      .select("id, status")
      .single();

    if (error || !data)
      return sendRowError(
        res,
        error,
        "Donation not found",
        "Unable to complete follow-up",
      );

    return res.status(200).json({ id: data.id, status: data.status });
  },
);

export default router;
