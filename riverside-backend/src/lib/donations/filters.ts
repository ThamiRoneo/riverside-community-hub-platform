import { UUID_PATTERN } from "../validation";

/**
 * `date_to` is inclusive, so a bare date covers the whole day rather than
 * stopping at midnight and hiding everything after it.
 */
export function endOfDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

/**
 * The filters the contract gives both donation endpoints, or null when a value
 * cannot match the column. Silently dropping an unusable filter would answer
 * with rows the caller did not ask for, which is worse than telling them.
 */
export function donationFilterError(
  query: Record<string, unknown>,
  allowedTypes: string[],
  allowedStatuses: string[],
): string | null {
  const { campaign_id, type, status, date_from, date_to } = query;

  if (type !== undefined && !allowedTypes.includes(String(type)))
    return `type must be one of: ${allowedTypes.join(", ")}`;
  if (status !== undefined && !allowedStatuses.includes(String(status)))
    return `status must be one of: ${allowedStatuses.join(", ")}`;
  if (campaign_id !== undefined && !UUID_PATTERN.test(String(campaign_id)))
    return "campaign_id must be a uuid";
  for (const [name, value] of [
    ["date_from", date_from],
    ["date_to", date_to],
  ] as const) {
    if (value !== undefined && Number.isNaN(Date.parse(String(value))))
      return `${name} must be an ISO date`;
  }
  if (date_from !== undefined && date_to !== undefined) {
    if (Date.parse(endOfDay(String(date_to))) < Date.parse(String(date_from)))
      return "date_to must not be before date_from";
  }

  return null;
}

/**
 * The slice of a PostgREST builder these filters need. Declared structurally so
 * the shared helper serves both endpoints; returning `any` from each method
 * keeps TypeScript from walking the generated database types through the
 * filter chain, which it does to death on a generic that preserves the type.
 */
export interface Filterable {
  eq(column: string, value: unknown): any;
  gte(column: string, value: string): any;
  lte(column: string, value: string): any;
  range(from: number, to: number): any;
}

export function applyDonationFilters<T extends Filterable>(
  builder: T,
  query: Record<string, unknown>,
): T {
  const { campaign_id, type, status, date_from, date_to } = query;
  let next: any = builder;

  if (campaign_id !== undefined) next = next.eq("campaign_id", String(campaign_id));
  if (type !== undefined) next = next.eq("type", String(type));
  if (status !== undefined) next = next.eq("status", String(status));
  if (date_from !== undefined) next = next.gte("created_at", String(date_from));
  if (date_to !== undefined) next = next.lte("created_at", endOfDay(String(date_to)));

  return next as T;
}
