import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;
let browserClientKey = "";

export function createClient() {
  const config = readSupabaseConfig();
  if (!config.ok) {
    throw new Error(config.message);
  }

  const cacheKey = `${config.url}|${config.key}`;
  if (!browserClient || browserClientKey !== cacheKey) {
    browserClient = createSupabaseClient(config.url, config.key);
    browserClientKey = cacheKey;
  }

  return browserClient;
}

export { isSupabaseConfigured } from "@/lib/supabase/config";
