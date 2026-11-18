import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PRICING, formatUsd } from "@/lib/pricing";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("ownersTitle") };
}

export default async function ForRestaurantsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owners");
  const { user } = await getUser();
  const cta = user ? { href: "/panel", label: t("ctaLoggedIn") } : { href: "/entrar?owner=1", label: t("cta") };

  const benefits = [
    { icon: "🔎", title: t("benefit1Title"), body: t("benefit1Body") },
    { icon: "📱", title: t("benefit2Title"), body: t("benefit2Body") },
    { icon: "🤝", title: t("benefit3Title"), body: t("benefit3Body") },
  ];
  const includes = [t("includes1"), t("includes2"), t("includes3"), t("includes4")];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="max-w-3xl">
        <h1 className="font-display text-4xl font-bold leading-tight text-balance sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 text-lg text-muted text-pretty">{t("subtitle")}</p>
        <Link href={cta.href} className="btn-primary mt-6 px-7 py-3 text-base">{cta.label}</Link>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="card p-5">
            <p className="text-3xl" aria-hidden="true">{b.icon}</p>
            <h2 className="mt-3 font-semibold">{b.title}</h2>
            <p className="mt-1 text-sm text-muted">{b.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-14" aria-labelledby="pricing">
        <h2 id="pricing" className="font-display text-3xl font-bold">{t("pricingTitle")}</h2>
        <p className="mt-1 font-medium text-ok">{t("trial", { days: PRICING.trialDays })}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
          <div className="card p-6">
            <p className="font-semibold">{t("monthly")}</p>
            <p className="mt-2 text-4xl font-bold">
              {formatUsd(PRICING.monthly, locale)}
              <span className="text-base font-normal text-muted">{t("perMonth")}</span>
            </p>
          </div>
          <div className="card border-2 border-brand p-6">
            <p className="font-semibold">
              {t("yearly")} <span className="badge ml-1 bg-brand-soft text-brand">{t("yearlySaving")}</span>
            </p>
            <p className="mt-2 text-4xl font-bold">
              {formatUsd(PRICING.yearly, locale)}
              <span className="text-base font-normal text-muted">{t("perYear")}</span>
            </p>
          </div>
          <ul className="card space-y-2 p-6 text-sm">
            {includes.map((i) => (
              <li key={i} className="flex gap-2">
                <span className="text-ok" aria-hidden="true">✓</span>
                {i}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-sm text-muted">{t("foundingNote")}</p>
        <Link href={cta.href} className="btn-primary mt-6">{cta.label}</Link>
      </section>
    </div>
  );
}
