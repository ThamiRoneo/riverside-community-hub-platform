import type { Response } from "express";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * PostgREST error codes we need to tell apart. Collapsing "no rows matched"
 * (PGRST116) into a generic 404 hides genuine write failures, which is how a
 * rejected write once masqueraded as a missing record.
 */
const NO_ROWS = "PGRST116";
const FOREIGN_KEY_VIOLATION = "23503";

/** Distinguishes an absent row (404) from a failed write (500). */
export function sendRowError(
  res: Response,
  error: PostgrestError | null,
  notFoundMessage: string,
  failureMessage: string,
) {
  if (error && error.code !== NO_ROWS) {
    return res.status(500).json({ error: failureMessage });
  }
  return res.status(404).json({ error: notFoundMessage });
}

/** A referenced parent row still exists, so the delete is a conflict (409). */
export function isForeignKeyViolation(error: PostgrestError | null): boolean {
  return error?.code === FOREIGN_KEY_VIOLATION;
}
