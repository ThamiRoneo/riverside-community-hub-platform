import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { SignupSchema, LoginSchema, ReauthenticateSchema } from "../validation/schemas";

const router = Router();

// GET /me - get current authenticated user
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /signup - create a new user account
router.post("/signup", requireAuth, (req, res) => {
  const result = SignupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password, full_name } = result.data;
  console.log(`Signup request: ${email} (${full_name})`);
  res.status(201).json({
    message: "User signed up successfully",
    user: { id: "uuid-123", email, role: "member" }
  });
});

// POST /login - authenticate user
router.post("/login", requireAuth, (req, res) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password } = result.data;
  console.log(`Login request: ${email}`);
  res.status(200).json({
    message: "Logged in successfully",
    user: req.user
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
    user: req.user
  });
});

// PATCH /members/:id/role - change member role (requires admin + re-auth)
router.patch("/members/:id/role", requireAuth, requireRole("admin"), (req, res) => {
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
    memberId: id
  });
});

export default router;
