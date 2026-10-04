/**
 * Neutralises spreadsheet formula injection. Donor- and member-supplied fields
 * reach the CSV and are opened in Excel by staff, so a leading = + - @ or a
 * control character would otherwise be evaluated as a formula.
 */
export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Wraps a header row and body rows into a CSV document. */
export function csvDocument(columns: string[], rows: string[]) {
  return [columns.join(","), ...rows].join("\n");
}
