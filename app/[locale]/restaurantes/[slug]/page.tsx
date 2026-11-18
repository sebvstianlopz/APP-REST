import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getRestaurant, searchRestaurants } from "@/lib/data";
import { parseDishes } from "@/lib/search-params";
import { formatUsd } from "@/lib/pricing";
import { photoUrl } from "@/lib/storage";
import { env } from "@/lib/env";
import { DAYS, type MenuItem, type RestaurantDetail } from "@/lib/types";
import { Photo } from "@/components/photo";
import { PriceRange } from "@/components/price-range";
import { RestaurantMap } from "@/components/restaurant-map";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const description = (r: RestaurantDetail, locale: string) =>
  (locale === "en" ? r.description_en || r.description_es : r.description_es || r.description_en) ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await getRestaurant(slug);
  if (!r) return {};
  const img = photoUrl(r.cover_photo_path);
  return {
    title: `${r.name}${r.municipality ? ` · ${r.municipality.name}` : ""} · Antojo PR`,
    description: description(r, locale) || undefined,
    alternates: { canonical: `/${locale}/restaurantes/${slug}`, languages: { es: `/es/restaurantes/${slug}`, en: `/en/restaurantes/${slug}` } },
    openGraph: img ? { images: [img] } : undefined,
    robots: r.is_listed ? undefined : { index: false },
  };
}

function groupMenu(menu: MenuItem[], other: string) {
  const groups = new Map<string, MenuItem[]>();
  for (const item of menu) {
    const key = item.category?.trim() || other;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

function jsonLd(r: RestaurantDetail, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    url: `${env.siteUrl}/${locale}/restaurantes/${r.slug}`,
    description: description(r, locale) || undefined,
    image: photoUrl(r.cover_photo_path) ?? undefined,
    telephone: r.phone ?? undefined,
    priceRange: r.price_range ? "$".repeat(r.price_range) : undefined,
    servesCuisine: r.cuisine_tags.length ? r.cuisine_tags : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: r.address ?? undefined,
      addressLocality: r.municipality?.name,
      addressRegion: "PR",
      addressCountry: "US",
    },
    geo: r.lat !== null ? { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng } : undefined,
    hasMenu: {
      "@type": "Menu",
      hasMenuItem: r.menu.slice(0, 100).map((m) => ({
        "@type": "MenuItem",
        name: m.name,
        description: m.description ?? undefined,
        offers: m.price !== null ? { "@type": "Offer", price: m.price, priceCurrency: "USD" } : undefined,
      })),
    },
  };
}

export default async function RestaurantPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const r = await getRestaurant(slug);
  if (!r) notFound();

  const t = await getTranslations("restaurant");
  const td = await getTranslations("days");
  const dishes = parseDishes(typeof sp.platos === "string" ? sp.platos : undefined);

  // Which menu items match what the diner searched for?
  const match = dishes.length && r.is_listed ? (await searchRestaurants({ dishes }, { restaurantId: r.id }))[0] : undefined;
  const matchedIds = new Set(match?.matched_items.map((m) => m.id) ?? []);
  const matched = r.menu.filter((m) => matchedIds.has(m.id));
  const groups = groupMenu(r.menu, t("other"));
  const desc = description(r, locale);
  const directions =
    r.lat !== null && r.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`
      : r.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.address}, Puerto Rico`)}`
        : null;
  const hasHours = DAYS.some((d) => r.hours?.[d]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(r, locale)).replace(/</g, "\\u003c") }} />

      {!r.is_listed && (
        <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn" role="status">
          {t("previewBanner")}
        </p>
      )}
      {dishes.length > 0 && (
        <Link href={{ pathname: "/buscar", query: { platos: dishes.join(",") } }} className="mb-4 inline-flex text-sm font-medium text-sea hover:underline">
          ← {t("backToResults")}
        </Link>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Photo path={r.cover_photo_path} alt={r.name} name={r.name} className="h-48 w-full rounded-2xl sm:h-36 sm:w-48" />
            <div>
              <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{r.name}</h1>
              <p className="mt-1 flex flex-wrap gap-x-2 text-muted">
                {r.municipality && <span>{r.municipality.name}</span>}
                {r.price_range && (
                  <span>
                    · <PriceRange value={r.price_range} label={t("price")} />
                  </span>
                )}
                {r.cuisine_tags.length > 0 && <span>· {r.cuisine_tags.join(", ")}</span>}
              </p>
              {desc && <p className="mt-2 max-w-2xl text-pretty">{desc}</p>}
            </div>
          </header>

          {matched.length > 0 && (
            <section aria-labelledby="matched" className="mt-6 rounded-2xl border-2 border-brand/40 bg-brand-soft/60 p-4">
              <h2 id="matched" className="font-semibold text-brand">★ {t("matchedTitle")}</h2>
              <ul className="mt-2 divide-y divide-brand/15">
                {matched.map((m) => (
                  <MenuRow key={m.id} item={m} locale={locale} />
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="menu" className="mt-8">
            <h2 id="menu" className="font-display text-2xl font-bold">{t("menu")}</h2>
            {groups.length === 0 ? (
              <p className="mt-3 text-muted">{t("noMenu")}</p>
            ) : (
              groups.map(([category, items]) => (
                <div key={category} className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{category}</h3>
                  <ul className="mt-1 divide-y divide-line">
                    {items.map((m) => (
                      <MenuRow key={m.id} item={m} locale={locale} highlight={matchedIds.has(m.id)} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="flex gap-2">
            {r.phone && (
              <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="btn-primary flex-1">
                📞 {t("call")}
              </a>
            )}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">
                🧭 {t("directions")}
              </a>
            )}
          </div>
          {r.lat !== null && r.lng !== null && <RestaurantMap lat={r.lat} lng={r.lng} name={r.name} />}
          {r.address && <p className="text-sm">{r.address}</p>}
          {r.website && (
            <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-sm font-medium text-sea hover:underline">
              {t("website")} ↗
            </a>
          )}
          {hasHours && (
            <div className="card p-4">
              <h2 className="font-semibold">{t("hours")}</h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {DAYS.map((d) => (
                  <div key={d} className="contents">
                    <dt className="text-muted">{td(d)}</dt>
                    <dd className="text-right tabular-nums">{r.hours?.[d] || <span className="text-muted">{t("closed")}</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MenuRow({ item, locale, highlight }: { item: MenuItem; locale: string; highlight?: boolean }) {
  return (
    <li className={`flex gap-4 py-3 ${highlight ? "-mx-2 rounded-lg bg-brand-soft/50 px-2" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {highlight && <span className="mr-1 text-brand" aria-hidden="true">★</span>}
          {item.name}
        </p>
        {item.description && <p className="text-sm text-muted">{item.description}</p>}
      </div>
      {item.price !== null && <p className="shrink-0 font-semibold tabular-nums">{formatUsd(item.price, locale)}</p>}
    </li>
  );
}
