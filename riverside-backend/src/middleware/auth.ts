import { NextFunction, Request, Response } from "express";
import { supabaseAdmin, supabaseForUser } from "../config/supabase";
import { Role } from "../types";

//  Verifies the bearer token via Supabase Auth. then loads the user's role from profiles
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: "No profile found for user" });
  }

  // Deactivated accounts keep their history and their password but lose access.
  // Their token is still valid, so the check has to live here rather than in
  // the login response.
  if (profile.active === false) {
    return res.status(403).json({ error: "This account has been deactivated" });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role as Role,
  };
  req.accessToken = token;

  next();
}

// For routes that work for both anonymous visitors and logged-in users
export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return next();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .single();

  // A deactivated account is treated as absent here too, otherwise a public
  // route with an optional session would still act on its behalf.
  if (profile && profile.active !== false) {
    req.user = { id: data.user.id, email: data.user.email, role: profile.role as Role };
    req.accessToken = token;
  }

  next();
}

export { supabaseForUser };
