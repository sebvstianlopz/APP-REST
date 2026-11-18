import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getManagedRestaurant } from "@/lib/panel";
import { StatusBadge } from "@/components/status-badge";
import { PanelTabs } from "./tabs";

export default async function RestaurantPanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const r = await getManagedRestaurant(locale, id);
  const t = await getTranslations("panel");

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/panel?nuevo=1" className="text-sm text-muted hover:text-ink">← {t("myRestaurants")}</Link>
          <h1 className="mt-1 font-display text-3xl font-bold">{r.name}</h1>
          <div className="mt-2"><StatusBadge status={r.status} listed={r.is_listed} /></div>
        </div>
        <Link href={`/restaurantes/${r.slug}`} className="btn-secondary self-start sm:self-auto" target="_blank">
          {t("viewPublic")} ↗
        </Link>
      </div>
      <PanelTabs
        id={id}
        labels={{ overview: t("nav.overview"), profile: t("nav.profile"), menu: t("nav.menu"), billing: t("nav.billing") }}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
