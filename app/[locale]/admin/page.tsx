import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireUser } from "@/lib/panel";
import { StatusBadge } from "@/components/status-badge";
import type { RestaurantStatus } from "@/lib/types";
import { addDish, setRestaurantStatus } from "./actions";

interface AdminRow {
  id: string;
  slug: string;
  name: string;
  status: RestaurantStatus;
  is_listed: boolean;
  created_at: string;
  municipalities: { name: string } | null;
  subscriptions: { status: string } | null;
  menu_items: { count: number }[];
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, profile } = await requireUser(locale);
  if (profile?.role !== "admin") notFound();
  const t = await getTranslations("admin");

  const [{ data: rows }, { data: dishes }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, slug, name, status, is_listed, created_at, municipalities(name), subscriptions(status), menu_items(count)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("dishes").select("id, slug, name_es, name_en, aliases").order("name_es"),
  ]);
  const restaurants = (rows ?? []) as unknown as AdminRow[];
  const pending = restaurants.filter((r) => r.status === "pending_review");

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>

      <section>
        <h2 className="text-lg font-semibold">{t("pending")} ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-muted">{t("noPending")}</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {pending.map((r) => (
              <li key={r.id} className="card flex flex-col gap-3 p-4">
                <div>
                  <Link href={`/restaurantes/${r.slug}`} className="font-semibold hover:text-brand" target="_blank">{r.name} ↗</Link>
                  <p className="text-sm text-muted">
                    {r.municipalities?.name ?? "—"} · {t("items")}: {r.menu_items[0]?.count ?? 0} · {t("membership")}: {r.subscriptions?.status ?? "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={setRestaurantStatus.bind(null, r.id, "active")}><button className="btn-primary">{t("approve")}</button></form>
                  <form action={setRestaurantStatus.bind(null, r.id, "draft")}><button className="btn-secondary">↩</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t("all")} ({restaurants.length})</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <tbody className="divide-y divide-line">
              {restaurants.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-muted">{r.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.status} listed={r.is_listed} /></td>
                  <td className="px-4 py-2.5 text-muted">{r.subscriptions?.status ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "active" ? (
                      <form action={setRestaurantStatus.bind(null, r.id, "suspended")}><button className="text-danger hover:underline">{t("suspend")}</button></form>
                    ) : r.status === "suspended" ? (
                      <form action={setRestaurantStatus.bind(null, r.id, "active")}><button className="text-sea hover:underline">{t("reactivate")}</button></form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t("dishes")} ({dishes?.length ?? 0})</h2>
        <p className="text-sm text-muted">{t("dishesHint")}</p>
        <form action={addDish} className="card mt-3 grid gap-3 p-4 sm:grid-cols-4 sm:items-end">
          <div><label className="label" htmlFor="name_es">{t("nameEs")}</label><input id="name_es" name="name_es" required className="input" /></div>
          <div><label className="label" htmlFor="name_en">{t("nameEn")}</label><input id="name_en" name="name_en" required className="input" /></div>
          <div><label className="label" htmlFor="aliases">{t("aliases")}</label><input id="aliases" name="aliases" className="input" /></div>
          <button className="btn-primary">{t("addDish")}</button>
        </form>
        <ul className="mt-3 columns-1 gap-6 text-sm sm:columns-2 lg:columns-3">
          {(dishes ?? []).map((d) => (
            <li key={d.id} className="mb-1 break-inside-avoid">
              <span className="font-medium">{d.name_es}</span> <span className="text-muted">/ {d.name_en}</span>
              {d.aliases.length > 0 && <span className="block text-xs text-muted">{d.aliases.join(", ")}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
