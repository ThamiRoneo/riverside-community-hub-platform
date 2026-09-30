/**
 * Contract pagination: `page` is 1-based and `page_size` is capped so a client
 * cannot ask for the whole table in one response.
 */
export function pagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(query.page_size ?? "10"), 10) || 10),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}