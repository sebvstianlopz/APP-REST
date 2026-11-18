import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "./supabase/server";
import { redirect } from "@/i18n/routing";
import type { Hours, RestaurantStatus } from "./types";

export interface OwnedRestaurant {
  id: string;
  slug: string;
  name: string;
  description_es: string | null;
  description_en: string | null;
  address: string | null;
  municipality_id: number | null;
  phone: string | null;
  website: string | null;
  hours: Hours;
  price_range: number | null;
  cuisine_tags: string[];
  cover_photo_path: string | null;
  status: RestaurantStatus;
  is_listed: boolean;
  lat: number | null;
  lng: number | null;
  subscriptions: {
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
  } | null;
  menu_items: { count: number }[];
}

const COLUMNS =
  "id, slug, name, description_es, description_en, address, municipality_id, phone, website, hours, price_range, " +
  "cuisine_tags, cover_photo_path, status, is_listed, lat, lng, " +
  "subscriptions(status, current_period_end, cancel_at_period_end, stripe_customer_id), menu_items(count)";

/** The signed-in user (redirects to sign-in when there is none). */
export const requireUser = cache(async (locale: string) => {
  const ctx = await getProfile();
  if (!ctx.user) redirect({ href: "/entrar?owner=1", locale });
  return ctx as typeof ctx & { user: NonNullable<typeof ctx.user> };
});

export async function listMyRestaurants(locale: string) {
  const { supabase, user } = await requireUser(locale);
  const { data, error } = await supabase
    .from("restaurants")
    .select(COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as OwnedRestaurant[];
}

/** A restaurant the user may manage (owner, or admin via RLS); 404 otherwise. */
export const getManagedRestaurant = cache(async (locale: string, id: string) => {
  const { supabase } = await requireUser(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data, error } = await supabase.from("restaurants").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  return data as unknown as OwnedRestaurant;
});

export function readiness(r: OwnedRestaurant) {
  const menuCount = r.menu_items[0]?.count ?? 0;
  const membership = r.subscriptions?.status ?? null;
  return {
    menuCount,
    profile: Boolean(r.address && r.municipality_id && r.lat !== null && r.lng !== null),
    menu: menuCount >= 3,
    membership: membership !== null && ["active", "trialing", "past_due"].includes(membership),
    approved: r.status === "active",
  };
}
