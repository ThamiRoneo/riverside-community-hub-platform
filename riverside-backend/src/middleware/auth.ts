import { NextFunction, Request, Response } from "express";
import { supabaseAdmin, supabaseForUser } from "../config/supabase";
import { Role } from "../types";

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
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: "No profile found for user" });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role as Role,
  };
  req.accessToken = token;

  next();
}

export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return next();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile) {
    req.user = { id: data.user.id, email: data.user.email, role: profile.role as Role };
    req.accessToken = token;
  }

  next();
}

export { supabaseForUser };
