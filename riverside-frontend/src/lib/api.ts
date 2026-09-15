import { supabase } from "./supabase";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
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
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await apiError(response);

  return (await response.json()) as T;
}

export async function apiPatch<T>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
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

export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: await authHeaders(),
  });

  if (!response.ok) throw await apiError(response);
  return response.blob();
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
