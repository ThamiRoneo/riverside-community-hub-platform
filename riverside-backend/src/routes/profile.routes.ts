import { Router } from "express";
import { supabaseAdmin } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import {
  MemberProfileUpdateSchema,
  ProfileCompleteSchema,
} from "../validation/schemas";

const router = Router();

const PROFILE_COLUMNS =
  "id, full_name, phone, role, membership_tier, membership_expires_at, created_at";

const EXPIRING_SOON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  membership_tier: string | null;
  membership_expires_at: string | null;
  created_at: string;
};

// Shapes a profile row into the API contract response, renaming `phone` to
// `contact_phone` and computing the expiring_soon flag.
function toProfileResponse(profile: ProfileRow) {
  const expiresAt = profile.membership_expires_at
    ? new Date(profile.membership_expires_at).getTime()
    : null;
  const now = Date.now();

  return {
    id: profile.id,
    full_name: profile.full_name,
    contact_phone: profile.phone,
    role: profile.role,
    membership_tier: profile.membership_tier ?? "free",
    membership_expires_at: profile.membership_expires_at,
    joined_at: profile.created_at,
    created_at: profile.created_at,
    expiring_soon:
      expiresAt !== null &&
      expiresAt >= now &&
      expiresAt <= now + EXPIRING_SOON_WINDOW_MS,
  };
}

async function loadProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as ProfileRow;
}

// POST /api/profile/complete
router.post("/complete", requireAuth, async (req, res) => {
  const result = ProfileCompleteSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { full_name, contact_phone } = result.data;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ full_name, phone: contact_phone ?? null })
    .eq("id", req.user!.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data)
    return res.status(404).json({ error: "Profile not found" });

  return res.status(200).json(toProfileResponse(data as ProfileRow));
});

// GET /api/profile/me
router.get("/me", requireAuth, async (req, res) => {
  const profile = await loadProfile(req.user!.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  return res.status(200).json(toProfileResponse(profile));
});

// PATCH /api/profile/me
router.patch("/me", requireAuth, async (req, res) => {
  const result = MemberProfileUpdateSchema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ error: "Invalid payload" });

  const { full_name, contact_phone } = result.data;

  // Build the patch explicitly. An empty update body is rejected by PostgREST,
  // and omitting keys entirely is what keeps a partial patch from wiping fields.
  const patch: { full_name?: string; phone?: string | null } = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (contact_phone !== undefined) patch.phone = contact_phone;

  if (Object.keys(patch).length === 0)
    return res
      .status(400)
      .json({ error: "Provide at least one of full_name or contact_phone" });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(patch)
    .eq("id", req.user!.id);

  if (error) return res.status(500).json({ error: "Unable to update profile" });

  const profile = await loadProfile(req.user!.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  return res.status(200).json(toProfileResponse(profile));
});

export default router;
