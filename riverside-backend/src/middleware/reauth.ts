import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";

export const REAUTH_TTL_MS = 5 * 60 * 1000;

export const REAUTH_HEADER = "x-reauth-token";

function reauthSecret(): string {
  const secret = process.env.REAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing REAUTH_SECRET environment variable");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", reauthSecret())
    .update(payload)
    .digest("base64url");
}

// Self-contained token: `<userId>.<expiresAtMs>.<hmac>`. Stateless, so no
// storage or cleanup. Short TTL limits the blast radius if one leaks.
export function issueReauthToken(userId: string): string {
  const expiresAt = Date.now() + REAUTH_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function isValidReauthToken(token: string, userId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [tokenUserId, expiresAt, signature] = parts;
  if (tokenUserId !== userId) return false;

  const expected = sign(`${tokenUserId}.${expiresAt}`);
  if (signature.length !== expected.length) return false;

  const provided = Buffer.from(signature);
  if (!crypto.timingSafeEqual(provided, Buffer.from(expected))) return false;

  return Number(expiresAt) > Date.now();
}

// Gates sensitive operations behind a fresh password check performed at
// POST /api/auth/reauthenticate.
export function requireReauth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const token = req.header(REAUTH_HEADER);
  if (!token) {
    return res.status(401).json({
      error: "Re-authentication required",
      code: "reauth_required",
    });
  }

  if (!isValidReauthToken(token, req.user.id)) {
    return res.status(401).json({
      error: "Re-authentication token is invalid or expired",
      code: "reauth_required",
    });
  }

  next();
}
