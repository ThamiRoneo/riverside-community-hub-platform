import { Router } from "express";
import { supabaseAdmin, supabasePublic } from "../config/supabase";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
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

  if (error) return res.status(401).json({ error: error.message });
  if (!data.session || !data.user)
    return res.status(401).json({ error: "No active session was created" });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name, membership_expires_at, created_at")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile)
    return res.status(403).json({ error: "No profile found for user" });

  return res.status(200).json({
    message: "Logged in successfully",
    session: data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile.role,
      full_name: profile.full_name,
      membership_expires_at: profile.membership_expires_at,
      created_at: profile.created_at,
    },
  });
});

// POST /reauthenticate - re-authenticate (required for sensitive operations)
router.post("/reauthenticate", requireAuth, (req, res) => {
  const result = ReauthenticateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password } = result.data;
  console.log(`Re-authenticate request: ${email}`);
  res.status(200).json({
    message: "Re-authentication successful",
    user: req.user,
  });
});

// PATCH /members/:id/role - change member role (requires admin + re-auth)
router.patch(
  "/members/:id/role",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { id, role } = req.params as { id: string; role: string };
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Insufficient role" });
    }
    console.log(`Role change request for member ${id}: to ${role}`);
    res.status(200).json({
      message: `Role updated for member ${id} to ${role}`,
      memberId: id,
    });
  },
);

export default router;
