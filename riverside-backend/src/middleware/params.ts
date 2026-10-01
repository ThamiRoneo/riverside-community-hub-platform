import type { NextFunction, Request, Response } from "express";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Postgres answers a non-uuid equality filter with a 22P02 syntax error, so a
 * garbage `:id` otherwise surfaces as a 500 and blames the database for a bad
 * URL. A malformed id is a missing record, so this turns it into a 404 before
 * the query runs.
 *
 * The message is deliberately generic. Naming the resource would make a 404
 * distinguishable from the 404 a real miss returns, for no benefit.
 */
export function requireUuidParam(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isUuid(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  return next();
}