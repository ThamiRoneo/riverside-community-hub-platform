/**
 * Layout constants shared by the admin management panels.
 *
 * Every page in this app styles itself with inline objects, which keeps the
 * components readable without a CSS layer. The cost is that the same six
 * constants were being copied panel by panel, so they live here instead. The
 * colour values are the ones already in use across the app.
 */
export const sectionStyle = { marginBottom: "1.5rem" } as const;

export const formStyle = {
  display: "grid",
  gap: "0.5rem",
  marginBottom: "1rem",
} as const;

export const rowStyle = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap" as const,
} as const;

export const listStyle = {
  listStyle: "none",
  margin: "0 0 1rem",
  padding: 0,
} as const;

export const itemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  // Without wrapping, the actions press against the details on a narrow phone,
  // which is the squeezed layout these panels replaced.
  flexWrap: "wrap" as const,
  padding: "0.75rem 0",
  borderBottom: "1px solid #e2e8f0",
} as const;

export const metaStyle = {
  margin: "0.15rem 0 0",
  fontSize: "0.875rem",
  color: "#64748b",
} as const;

export const errorStyle = {
  margin: "0.15rem 0 0",
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "#b91c1c",
} as const;

export const labelStyle = { fontWeight: 600 } as const;