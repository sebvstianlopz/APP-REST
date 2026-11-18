import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SearchForm } from "@/components/search-form";
import { getMunicipalities } from "@/lib/data";

const POPULAR = ["Mofongo", "Alcapurrias", "Lechón asado", "Chillo frito", "Pastelón", "Tripleta", "Arroz con gandules", "Flan"];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const municipalities = await getMunicipalities();

  const steps = [
    { n: 1, title: t("how1Title"), body: t("how1Body") },
    { n: 2, title: t("how2Title"), body: t("how2Body") },
    { n: 3, title: t("how3Title"), body: t("how3Body") },
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,var(--brand-soft),transparent_60%),radial-gradient(40rem_24rem_at_-10%_110%,var(--sea-soft),transparent_60%)]"
        />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-16">
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted text-pretty">{t("subtitle")}</p>
          <div className="mt-8">
            <SearchForm municipalities={municipalities} />
          </div>
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted">{t("popular")}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {POPULAR.map((dish) => (
                <li key={dish}>
                  <Link
                    href={{ pathname: "/buscar", query: { platos: dish } }}
                    className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-brand hover:text-brand"
                  >
                    {dish}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-bold">{t("howTitle")}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-sea-soft font-bold text-sea">{s.n}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="card flex flex-col gap-4 bg-sea p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8 dark:bg-sea-soft dark:text-ink">
          <div>
            <h2 className="font-display text-2xl font-bold">{t("ownerCtaTitle")}</h2>
            <p className="mt-1 opacity-90">{t("ownerCtaBody")}</p>
          </div>
          <Link href="/para-restaurantes" className="btn shrink-0 bg-white text-sea hover:bg-white/90 dark:bg-brand dark:text-on-brand">
            {t("ownerCtaButton")}
          </Link>
        </div>
      </section>
    </>
  );
}
