import { Pool, type PoolClient } from "pg";

export const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/apprest_test";

export const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

export type Role = "anon" | "authenticated" | "service_role";

/**
 * Run `fn` inside a transaction as a Supabase API role (optionally with a JWT
 * `sub`), then roll everything back so tests never leak state.
 */
export async function asRole<T>(
  role: Role,
  fn: (c: PoolClient) => Promise<T>,
  userId?: string,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role } : { role }),
    ]);
    await c.query(`set local role ${role}`);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

/** Run as the database owner inside a rolled-back transaction. */
export async function asOwner<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

export interface SearchRow {
  name: string;
  slug: string;
  municipality: string;
  distance_km: number | null;
  match_count: number;
  requested_count: number;
  matched_terms: string[];
  matched_items: { id: string; name: string; price: number; term: string }[];
}

export async function search(
  c: PoolClient,
  terms: string[],
  opts: { lat?: number; lng?: number; radiusKm?: number; municipalityId?: number; region?: string } = {},
): Promise<SearchRow[]> {
  const { rows } = await c.query<SearchRow>(
    `select * from public.search_restaurants(
       terms => $1, lat => $2, lng => $3, radius_km => $4,
       p_municipality_id => $5::smallint, p_region => $6::public.pr_region)`,
    [terms, opts.lat ?? null, opts.lng ?? null, opts.radiusKm ?? null, opts.municipalityId ?? null, opts.region ?? null],
  );
  return rows;
}
