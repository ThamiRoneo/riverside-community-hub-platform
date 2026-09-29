import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendRowError } from "../lib/http";
import { attachUserIfPresent, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { DonationCreateSchema } from "../validation/schemas";

const router = Router();

/**
 * Neutralises spreadsheet formula injection. Donor-supplied fields reach the
 * CSV and are opened in Excel by staff, so a leading = + - @ or a control
 * character would otherwise be evaluated as a formula.
 */
function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** An anonymous donation must not expose the donor's identity in an export. */
function redactAnonymous(donation: Record<string, unknown>) {
  if (!donation.anonymous) return donation;
  return { ...donation, donor_name: null, donor_email: null, donor_phone: null };
}

router.get(
  "/",
  requireAuth,
  requireRole("staff", "admin"),
  async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("donations")
      .select(
        "id, campaign_id, donor_id, amount, type, status, donor_name, donor_email, donor_phone, anonymous, receipt_opt_in, staff_note, created_at, campaigns(title)",
      )
      .order("created_at", { ascending: false });

    if (error)
      return res.status(500).json({ error: "Unable to load donations" });
    return res.status(200).json({ donations: data ?? [] });
  },
);

router.get(
  "/export.csv",
  requireAuth,
  requireRole("staff", "admin"),
  async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("donations")
      .select(
        "id, campaign_id, amount, type, status, donor_name, donor_email, donor_phone, anonymous, receipt_opt_in, staff_note, created_at",
      )
      .order("created_at", { ascending: false });

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
    return res.status(200).send([columns.join(","), ...rows].join("\n"));
  },
);

router.post("/", attachUserIfPresent, async (req, res) => {
  const result = DonationCreateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { data, error } = await supabaseAdmin
    .from("donations")
    .insert({
      ...result.data,
      donor_id: req.user?.id ?? null,
    })
    .select(
      "id, campaign_id, amount, type, anonymous, receipt_opt_in, created_at",
    )
    .single();

  if (error)
    return res.status(500).json({ error: "Unable to create donation" });
  return res.status(201).json({ message: "Donation created", donation: data });
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
