"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

/** Admin writes go through the admin's own session; RLS + the status guard trigger enforce the role. */
async function requireAdmin() {
  const ctx = await getProfile();
  if (ctx.profile?.role !== "admin") throw new Error("Forbidden");
  return ctx.supabase;
}

export async function setRestaurantStatus(id: string, status: "active" | "suspended" | "draft") {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("restaurants").update({ status }).eq("id", id);
  if (error) throw error;
  revalidatePath("/[locale]/admin", "page");
}

const dishSchema = z.object({
  name_es: z.string().trim().min(2).max(80),
  name_en: z.string().trim().min(2).max(80),
  aliases: z.string().max(500).transform((s) => [...new Set(s.split(",").map((a) => a.trim()).filter(Boolean))].slice(0, 20)),
  category: z.string().trim().max(40).optional(),
});

export async function addDish(form: FormData) {
  const supabase = await requireAdmin();
  const parsed = dishSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return;
  await supabase.from("dishes").insert({ ...parsed.data, slug: slugify(parsed.data.name_es) });
  revalidatePath("/[locale]/admin", "page");
}
