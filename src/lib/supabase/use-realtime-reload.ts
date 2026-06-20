"use client";

import { useEffect, useRef } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type RealtimeTableSpec = {
  table: string;
  filter?: string;
};

const RELOAD_DEBOUNCE_MS = 400;

/**
 * Re-runs `onReload` when listed tables change (Supabase Realtime).
 * Tables must be added to the `supabase_realtime` publication in Postgres.
 */
export function useSupabaseRealtimeReload(
  onReload: () => void | Promise<void>,
  tables: RealtimeTableSpec[],
  enabled = true
) {
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  const tablesKey = tables.map((spec) => `${spec.table}:${spec.filter ?? ""}`).join("|");

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured() || !tables.length) return;

    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let channel = supabase.channel(`realtime-reload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void onReloadRef.current();
      }, RELOAD_DEBOUNCE_MS);
    };

    for (const spec of tables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: spec.table,
          ...(spec.filter ? { filter: spec.filter } : {}),
        },
        scheduleReload
      );
    }

    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, tablesKey]);
}
