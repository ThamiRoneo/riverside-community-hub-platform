const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * UTC bounds for a YYYY-MM-DD string, or null when the value is not a real
 * calendar day, so 2026-02-31 is rejected instead of rolling into March.
 *
 * Bounds are UTC because opening hours are defined in UTC; a hub in another
 * timezone needs this to take a fixed offset instead.
 */
export function dayBounds(date: string) {
  if (!DAY_PATTERN.test(date)) return null;
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date)
    return null;

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Overlapping spans, half-open: a booking ending at 10:00 frees the 10:00 slot.
 *
 * Compared as instants, not strings. Postgres returns timestamps as
 * `...T10:00:00+00:00` while slots are built as `...T10:00:00.000Z`; as strings
 * `.` sorts after `+`, so a booking starting exactly when a slot ends looked
 * like an overlap and no slot ever became free.
 */
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return (
    Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd)
  );
}