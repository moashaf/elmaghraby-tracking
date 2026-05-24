import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from a table query, working around PostgREST's default row cap.
 */
export async function fetchAllRows<T>(
  runQuery: (rangeFrom: number, rangeTo: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await runQuery(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: all, error: error.message };
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { data: all, error: null };
}

export async function fetchAllFromTable<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  orderBy?: { column: string; ascending?: boolean }
): Promise<{ data: T[]; error: string | null }> {
  return fetchAllRows<T>(async (from, to) => {
    let query = supabase.from(table).select(select).range(from, to);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    const { data, error } = await query;
    return { data: data as T[] | null, error };
  });
}
