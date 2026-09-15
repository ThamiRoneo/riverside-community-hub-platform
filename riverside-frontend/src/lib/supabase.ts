import { createClient } from '@supabase/supabase-js';

// Anon key only — all privileged operations go through the Express API.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const API_URL = import.meta.env.VITE_API_URL as string;
