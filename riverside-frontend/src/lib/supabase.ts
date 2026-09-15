import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

// Anon key only — all privileged operations go through the Express API.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
