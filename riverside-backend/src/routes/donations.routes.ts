import crypto from "node:crypto";
import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { csvCell, csvDocument } from "../lib/csv";
import { applyDonationFilters, donationFilterError, endOfDay } from "../lib/donations/filters";
import { pagination } from "../lib/pagination";
import { isForeignKeyViolation, sendRowError } from "../lib/http";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { requireUuidParam } from "../middleware/params";
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

// GET /api/donations
// Contract: staff and admin, filterable by campaign, type, status and date, and
// paginated. `status=pending_followup` is the follow-up queue.
router.get(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (req, res) => {
    const filterError = donationFilterError(req.query, DONATION_TYPES, DONATION_STATUSES);
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
    const filterError = donationFilterError(req.query, DONATION_TYPES, DONATION_STATUSES);
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
  requireUuidParam,
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
