import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — only use in trusted server code
 * (Stripe webhook, analytics logging) and never with user-controlled filters
 * you haven't authorised first.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
