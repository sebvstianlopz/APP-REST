import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import { listMyRestaurants, readiness, requireUser } from "@/lib/panel";
import { getMunicipalities } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { Photo } from "@/components/photo";
import { CreateRestaurantForm } from "./create-form";

export default async function PanelHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ profile }, restaurants, municipalities, t, { nuevo }] = await Promise.all([
    requireUser(locale),
    listMyRestaurants(locale),
    getMunicipalities(),
    getTranslations("panel"),
    searchParams,
  ]);

  // Single-restaurant owners go straight to their restaurant.
  if (restaurants.length === 1 && !nuevo) redirect({ href: `/panel/${restaurants[0].id}`, locale });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("greeting", { name: profile?.full_name || "empty" })}</h1>
        {restaurants.length === 0 && <p className="mt-1 text-muted">{t("noRestaurants")}</p>}
      </div>

      {restaurants.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("myRestaurants")}</h2>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {restaurants.map((r) => {
              const ready = readiness(r);
              return (
                <li key={r.id}>
                  <Link href={`/panel/${r.id}`} className="card flex gap-4 p-4 hover:shadow-md">
                    <Photo path={r.cover_photo_path} alt={r.name} name={r.name} className="h-16 w-16 shrink-0 rounded-xl" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="mb-1.5 text-sm text-muted">{t("menu.count", { count: ready.menuCount })}</p>
                      <StatusBadge status={r.status} listed={r.is_listed} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CreateRestaurantForm municipalities={municipalities} />
    </div>
  );
}
