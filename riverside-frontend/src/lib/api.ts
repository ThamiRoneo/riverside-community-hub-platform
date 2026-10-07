import { supabase } from "./supabase";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Verifies the signed-in user's password and returns a short-lived step-up
// token for operations the API gates behind re-authentication.
export async function reauthenticate(password: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!session?.access_token || !email) {
    throw new Error("You must be signed in to perform this action.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/reauthenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw await apiError(response);

  const body = (await response.json()) as { reauth_token?: string };
  if (!body.reauth_token) {
    throw new Error("Re-authentication did not return a token.");
  }
  return body.reauth_token;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: await authHeaders(),
  });

  if (!response.ok) throw await apiError(response);

  return (await response.json()) as T;
}

export async function apiPost<T>(
  path: string,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await apiError(response);

  return (await response.json()) as T;
}

export async function apiPatch<T>(
  path: string,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await apiError(response);
  return (await response.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!response.ok) throw await apiError(response);
}

/**
 * Downloads a file and returns the blob with the filename the server chose.
 *
 * The filename comes back alongside the body because setting `link.download`
 * from the call site would override it: the export endpoints name their file
 * with the window and the date, so two downloads on the same day do not collide.
 */
export async function apiDownload(path: string): Promise<{
  blob: Blob;
  filename: string | null;
}> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: await authHeaders(),
  });

  if (!response.ok) throw await apiError(response);

  const disposition = response.headers.get("content-disposition") ?? "";
  // The server sends: attachment; filename=report-month-2026-10-01.csv
  const match = /filename="?([^";]+)"?/.exec(disposition);

  return {
    blob: await response.blob(),
    filename: match ? match[1] : null,
  };
}

/** Saves a downloaded file under the name the server chose. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

async function apiError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return new Error(body?.error ?? `Request failed: ${response.status}`);
}
