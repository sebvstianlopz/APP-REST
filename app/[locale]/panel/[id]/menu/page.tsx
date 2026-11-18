import { setRequestLocale } from "next-intl/server";
import { getManagedRestaurant, requireUser } from "@/lib/panel";
import { MenuEditor, type EditorItem } from "./menu-editor";

export default async function MenuPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await getManagedRestaurant(locale, id); // 404s unless the user manages it
  const { supabase } = await requireUser(locale);
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, category, position, is_available, dish:dishes(name_es, name_en)")
    .eq("restaurant_id", id)
    .order("category", { nullsFirst: false })
    .order("position")
    .order("name");
  if (error) throw error;
  const items = (data ?? []) as unknown as EditorItem[];
  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))];
  return <MenuEditor restaurantId={id} items={items} categories={categories} />;
}
