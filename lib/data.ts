import "server-only";
import { cache } from "react";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { env } from "./env";
import { createClient } from "./supabase/server";
import { createAdminClient, hasServiceRole } from "./supabase/admin";
import type { Municipality, RestaurantDetail, SearchResult } from "./types";
import type { SearchQuery } from "./search-params";

/** Cookie-less anonymous client for public, cacheable reads. */
function publicClient() {
  return createAnonClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getMunicipalities = cache(async (): Promise<Municipality[]> => {
  const { data, error } = await publicClient()
    .from("municipalities")
    .select("id, slug, name, region")
    .order("name");
  if (error) throw error;
  return data as Municipality[];
});

export async function searchRestaurants(
  q: SearchQuery,
  opts: { restaurantId?: string } = {},
): Promise<SearchResult[]> {
  if (!q.dishes.length) return [];
  let municipalityId: number | null = null;
  if (q.municipio) {
    const m = (await getMunicipalities()).find((x) => x.slug === q.municipio);
    if (!m) return [];
    municipalityId = m.id;
  }
  const { data, error } = await publicClient().rpc("search_restaurants", {
    terms: q.dishes,
    lat: q.lat ?? null,
    lng: q.lng ?? null,
    radius_km: q.radio ?? null,
    p_municipality_id: municipalityId,
    p_region: q.region ?? null,
    p_restaurant_id: opts.restaurantId ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as SearchResult[];

  if (!opts.restaurantId) void logSearch(q.dishes, municipalityId, rows.length);
  return rows;
}

/** Fire-and-forget analytics: what people search for, where, and how often we had an answer. */
async function logSearch(terms: string[], municipalityId: number | null, resultCount: number) {
  if (!hasServiceRole()) return;
  try {
    await createAdminClient()
      .from("search_events")
      .insert({ terms, municipality_id: municipalityId, result_count: resultCount });
  } catch {
    /* analytics must never break search */
  }
}

/** Uses the visitor's session so owners/admins can preview unlisted restaurants. */
export async function getRestaurant(slug: string): Promise<RestaurantDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_restaurant", { p_slug: slug });
  if (error) throw error;
  return (data as RestaurantDetail | null) ?? null;
}

export async function getListedSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const { data } = await publicClient().rpc("listed_restaurant_slugs");
  return (data ?? []) as { slug: string; updated_at: string }[];
}
