"use server";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { parseMenuCsv } from "@/lib/csv";
import { PHOTO_BUCKET } from "@/lib/storage";
import { DAYS } from "@/lib/types";

export type ActionState = { ok?: boolean; error?: string; message?: string; count?: number };

async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return { supabase, user: data.user };
}

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

// ---------------------------------------------------------------- restaurants

export async function createRestaurant(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await authed();
  const name = z.string().trim().min(2).max(120).safeParse(form.get("name"));
  if (!name.success) return { error: "name" };
  const municipality = z.coerce.number().int().min(1).max(78).safeParse(form.get("municipality_id"));

  await supabase.rpc("become_owner");
  const base = slugify(name.data) || "restaurante";
  let id: string | undefined;
  for (let attempt = 0; attempt < 5 && !id; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        owner_id: user.id,
        name: name.data,
        slug,
        municipality_id: municipality.success ? municipality.data : null,
      })
      .select("id")
      .single();
    if (data) id = data.id;
    else if (error?.code !== "23505") return { error: "generic" }; // anything but a slug clash
  }
  if (!id) return { error: "generic" };
  const locale = await getLocale();
  redirect({ href: `/panel/${id}/perfil`, locale });
  return { ok: true };
}

const hhmm = /^([01]?\d|2[0-3]):[0-5]\d\s*-\s*([01]?\d|2[0-4]):[0-5]\d$/;

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  description_es: optionalText(600),
  description_en: optionalText(600),
  address: optionalText(200),
  municipality_id: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(78).nullable()),
  phone: optionalText(30),
  website: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? (/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`) : null),
    z.url().max(300).nullable(),
  ),
  price_range: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(4).nullable()),
  cuisine_tags: z.string().max(300).transform((s) =>
    [...new Set(s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8),
  ),
  lat: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(17.8).max(18.6).nullable()),
  lng: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(-67.4).max(-65.1).nullable()),
});

export async function updateProfile(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await authed();
  const raw = Object.fromEntries(form.entries());
  const parsed = profileSchema.safeParse({ ...raw, cuisine_tags: raw.cuisine_tags ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.path.join(".") || "generic" };

  const hours: Record<string, string> = {};
  for (const d of DAYS) {
    const v = String(form.get(`hours_${d}`) ?? "").trim().replace(/\s+/g, "");
    if (!v) continue;
    if (!hhmm.test(v)) return { error: `hours_${d}` };
    hours[d] = v;
  }

  const { lat, lng, ...fields } = parsed.data;
  const { error } = await supabase
    .from("restaurants")
    .update({
      ...fields,
      hours,
      location: lat !== null && lng !== null ? `SRID=4326;POINT(${lng} ${lat})` : null,
    })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "slug" : "generic" };
  revalidatePath("/[locale]/panel", "layout");
  return { ok: true };
}

export async function uploadCoverPhoto(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await authed();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "photo" };
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
  if (!ext || file.size > 5 * 1024 * 1024) return { error: "photo" };

  const path = `${id}/cover-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
  if (upErr) return { error: "generic" };

  const { data: prev } = await supabase.from("restaurants").select("cover_photo_path").eq("id", id).single();
  const { error } = await supabase.from("restaurants").update({ cover_photo_path: path }).eq("id", id);
  if (error) return { error: "generic" };
  if (prev?.cover_photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([prev.cover_photo_path]);
  revalidatePath("/[locale]/panel", "layout");
  return { ok: true };
}

export async function setReviewStatus(id: string, submit: boolean) {
  const { supabase } = await authed();
  await supabase
    .from("restaurants")
    .update({ status: submit ? "pending_review" : "draft" })
    .eq("id", id)
    .eq("status", submit ? "draft" : "pending_review");
  revalidatePath("/[locale]/panel", "layout");
}

// ---------------------------------------------------------------- menu

const itemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalText(500),
  price: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.replace(/[$\s]/g, "").replace(",", ".")) : v),
    z.coerce.number().min(0).max(100000).nullable(),
  ),
  category: optionalText(60),
  position: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0).max(10000)),
  is_available: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveMenuItem(restaurantId: string, itemId: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await authed();
  const parsed = itemSchema.safeParse({
    ...Object.fromEntries(form.entries()),
    is_available: itemId ? form.get("is_available") : "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.path.join(".") || "generic" };

  const { error } = itemId
    ? // Renaming may change which dish it is: clear the tag and re-tag below.
      await supabase.from("menu_items").update({ ...parsed.data, dish_id: null }).eq("id", itemId).eq("restaurant_id", restaurantId)
    : await supabase.from("menu_items").insert({ ...parsed.data, restaurant_id: restaurantId });
  if (error) return { error: "generic" };
  await supabase.rpc("auto_tag_menu", { p_restaurant_id: restaurantId });
  revalidatePath("/[locale]/panel", "layout");
  return { ok: true };
}

export async function deleteMenuItem(restaurantId: string, itemId: string) {
  const { supabase } = await authed();
  await supabase.from("menu_items").delete().eq("id", itemId).eq("restaurant_id", restaurantId);
  revalidatePath("/[locale]/panel", "layout");
}

export async function importMenuCsv(restaurantId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await authed();
  const file = form.get("csv");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(form.get("csvText") ?? "");
  if (!text.trim() || text.length > 500_000) return { error: "import" };
  const rows = parseMenuCsv(text);
  if (!rows.length) return { error: "import" };

  const { count: existing } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  const { error } = await supabase
    .from("menu_items")
    .insert(rows.map((r, i) => ({ ...r, restaurant_id: restaurantId, position: (existing ?? 0) + i + 1 })));
  if (error) return { error: "import" };
  await supabase.rpc("auto_tag_menu", { p_restaurant_id: restaurantId });
  revalidatePath("/[locale]/panel", "layout");
  return { ok: true, count: rows.length };
}
