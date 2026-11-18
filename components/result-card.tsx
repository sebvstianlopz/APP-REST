import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { SearchResult } from "@/lib/types";
import { formatUsd } from "@/lib/pricing";
import { Photo } from "./photo";
import { PriceRange } from "./price-range";

export async function ResultCard({ r, dishesParam, rank }: { r: SearchResult; dishesParam: string; rank: number }) {
  const t = await getTranslations("results");
  const tr = await getTranslations("restaurant");
  const locale = await getLocale();
  const all = r.match_count === r.requested_count && r.requested_count > 1;
  const items = [...r.matched_items].sort((a, b) => a.position - b.position);
  const shown = items.slice(0, 3);

  return (
    <article className="card group relative flex gap-4 p-3 transition-shadow hover:shadow-md sm:p-4">
      <Photo path={r.cover_photo_path} alt={r.name} name={r.name} className="h-24 w-24 shrink-0 rounded-xl sm:h-28 sm:w-28" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand" aria-hidden="true">
            {rank}
          </span>
          <h3 className="font-display text-lg font-bold leading-tight">
            <Link
              href={{ pathname: `/restaurantes/${r.slug}`, query: { platos: dishesParam } }}
              className="after:absolute after:inset-0 hover:text-brand"
            >
              {r.name}
            </Link>
          </h3>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {r.municipality && <span>{r.municipality}</span>}
          {r.distance_km !== null && <span>· {t("kmAway", { km: r.distance_km })}</span>}
          {r.price_range && (
            <span>
              · <PriceRange value={r.price_range} label={tr("price")} />
            </span>
          )}
        </p>
        <p className={`badge mt-2 ${all ? "bg-ok-soft text-ok" : "bg-sea-soft text-sea"}`}>
          {all ? t("matchesAll") : t("matches", { count: r.match_count, total: r.requested_count })}
        </p>
        <ul className="mt-2 space-y-0.5 text-sm">
          {shown.map((it) => (
            <li key={it.id} className="flex justify-between gap-3">
              <span className="truncate">{it.name}</span>
              {it.price !== null && <span className="shrink-0 tabular-nums text-muted">{formatUsd(it.price, locale)}</span>}
            </li>
          ))}
          {items.length > shown.length && (
            <li className="text-xs text-muted">{t("andMore", { count: items.length - shown.length })}</li>
          )}
        </ul>
      </div>
    </article>
  );
}
