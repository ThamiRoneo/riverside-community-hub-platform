import { Router } from "express";
import { supabaseAdmin, supabasePublic } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { issueReauthToken, REAUTH_TTL_MS } from "../middleware/reauth";
import {
  SignupSchema,
  LoginSchema,
  ReauthenticateSchema,
} from "../validation/schemas";

const router = Router();

// GET /me - get current authenticated user
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /signup - create a new user account
router.post("/signup", async (req, res) => {
  const result = SignupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password, full_name } = result.data;
  const { data, error } = await supabasePublic.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });

  if (error) return res.status(400).json({ error: error.message });
  if (!data.user) return res.status(500).json({ error: "Signup failed" });

  // The on_auth_user_created trigger already inserts a profile row, so this
  // upsert updates that row rather than colliding with its primary key.
  const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: data.user.id,
      full_name,
      membership_expires_at: expiration,
      role: "member",
      phone: null,
      membership_tier: "free",
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return res.status(500).json({ error: "Failed to create profile" });
  }


  return res.status(201).json({
    message: data.session
      ? "User signed up successfully"
      : "Check your email to verify your account",
    session: data.session,
    user: { id: data.user.id, email: data.user.email, role: "member" },
  });
});


// POST /login - authenticate user
router.post("/login", async (req, res) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password } = result.data;
  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email,
    password,
  });

  // A request that never reached the service is not a wrong password, and
  // neither is being rate-limited. Only an answered 4xx about the credentials
  // means those were rejected.
  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 429)
      return res.status(429).json({ error: "Too many sign-in attempts" });
    return status != null
      ? res.status(401).json({ error: error.message })
      : res.status(503).json({ error: "Sign-in service is unavailable" });
  }

  if (!data.session || !data.user)
    return res.status(401).json({ error: "No active session was created" });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(
      "role, full_name, membership_tier, phone, membership_expires_at, created_at, active",
    )
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile)
    return res.status(403).json({ error: "No profile found for user" });

  // Refused here rather than handed a session that every later request rejects,
  // so the person is told why instead of seeing a loop of 403s.
  if (profile.active === false)
    return res.status(403).json({ error: "This account has been deactivated" });

  return res.status(200).json({
    message: "Logged in successfully",
    session: data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile.role,
      full_name: profile.full_name,
      membership_tier: profile.membership_tier || "free",
      joined_at: profile.created_at || data.user.created_at,
      membership_expires_at: profile.membership_expires_at,
      created_at: profile.created_at,
    },
  });
});

// POST /api/reauthenticate - verify the caller's password and issue a
// short-lived step-up token for sensitive operations.
router.post("/reauthenticate", requireAuth, async (req, res) => {
  const result = ReauthenticateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { email, password } = result.data;

  // Only the signed-in account may be re-authenticated, so a valid password
  // for some *other* account cannot be used to unlock this session.
  if (email !== req.user!.email) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || data.user.id !== req.user!.id) {
    const answered = (error as { status?: number } | null)?.status != null;
    return answered || !error
      ? res.status(401).json({ error: "Invalid credentials" })
      : res.status(503).json({ error: "Sign-in service is unavailable" });
  }

  return res.status(200).json({
    message: "Re-authentication successful",
    reauth_token: issueReauthToken(req.user!.id),
    expires_in: Math.floor(REAUTH_TTL_MS / 1000),
  });
});

export default router;
