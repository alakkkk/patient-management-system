import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Copy .env.example to .env and fill it in."
  );
}

// Service-role client: full database access, bypasses RLS.
// Only ever used on the server, after we've verified the caller's token.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
