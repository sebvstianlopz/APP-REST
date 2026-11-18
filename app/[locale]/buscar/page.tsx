import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SearchForm } from "@/components/search-form";
import { ResultCard } from "@/components/result-card";
import { ResultsView } from "@/components/results-view";
import { getMunicipalities, searchRestaurants } from "@/lib/data";
import { parseSearchParams, toSearchString } from "@/lib/search-params";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const q = parseSearchParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "meta" });
  const qs = toSearchString({ dishes: q.dishes, municipio: q.municipio, region: q.region });
  return {
    title: q.dishes.length ? t("searchTitle", { dishes: q.dishes.join(", ") }) : t("homeTitle"),
    // Location-specific (lat/lng) result pages shouldn't be indexed.
    robots: q.lat !== undefined || !q.dishes.length ? { index: false } : undefined,
    alternates: { canonical: `/${locale}/buscar?${qs}` },
  };
}

function listFormat(items: string[], locale: string) {
  return new Intl.ListFormat(locale === "en" ? "en" : "es", { style: "long", type: "disjunction" }).format(items);
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const q = parseSearchParams(await searchParams);
  const [t, tr, municipalities] = await Promise.all([
    getTranslations("results"),
    getTranslations("regions"),
    getMunicipalities(),
  ]);
  const results = await searchRestaurants(q);
  const dishesParam = q.dishes.join(",");

  const place =
    q.lat !== undefined
      ? t("nearYou")
      : q.municipio
        ? t("where", { place: municipalities.find((m) => m.slug === q.municipio)?.name ?? q.municipio })
        : q.region
          ? t("where", { place: tr(q.region) })
          : t("where", { place: "Puerto Rico" });

  const points = results
    .filter((r) => r.lat !== null && r.lng !== null)
    .map((r, i) => ({
      id: r.restaurant_id,
      lat: r.lat!,
      lng: r.lng!,
      label: r.name,
      rank: i + 1,
      href: `/${locale}/restaurantes/${r.slug}?platos=${encodeURIComponent(dishesParam)}`,
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <SearchForm municipalities={municipalities} initial={q} variant="compact" key={toSearchString(q)} />

      {!q.dishes.length ? (
        <div className="py-16 text-center">
          <h1 className="font-display text-2xl font-bold">{t("emptyTitle")}</h1>
          <p className="mt-2 text-muted">{t("emptyBody")}</p>
        </div>
      ) : (
        <>
          <h1 className="mt-6 mb-4 text-lg" aria-live="polite">
            <span className="font-semibold">
              {t("summary", { count: results.length, dishes: listFormat(q.dishes, locale) })}
            </span>{" "}
            <span className="text-muted">{place}</span>
          </h1>

          {results.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="text-4xl" aria-hidden="true">🍽️</p>
              <h2 className="mt-3 font-display text-xl font-bold">{t("noResultsTitle")}</h2>
              <p className="mx-auto mt-1 max-w-md text-muted">{t("noResultsBody")}</p>
              {(q.municipio || q.region || q.lat !== undefined) && (
                <Link href={`/buscar?${toSearchString({ dishes: q.dishes })}`} className="btn-primary mt-5">
                  {t("searchIsland")}
                </Link>
              )}
            </div>
          ) : (
            <ResultsView
              points={points}
              me={q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null}
              labels={{ list: t("list"), map: t("map") }}
            >
              <ol className="space-y-3">
                {results.map((r, i) => (
                  <li key={r.restaurant_id}>
                    <ResultCard r={r} dishesParam={dishesParam} rank={i + 1} />
                  </li>
                ))}
              </ol>
            </ResultsView>
          )}
        </>
      )}
    </div>
  );
}
