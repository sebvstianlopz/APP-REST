import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getManagedRestaurant, readiness } from "@/lib/panel";
import { setReviewStatus } from "../actions";

export default async function Overview({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const r = await getManagedRestaurant(locale, id);
  const t = await getTranslations("panel");
  const ready = readiness(r);

  const steps = [
    { done: ready.profile, label: t("stepProfile"), href: `/panel/${id}/perfil` },
    { done: ready.menu, label: t("stepMenu"), href: `/panel/${id}/menu`, extra: t("menu.count", { count: ready.menuCount }) },
    { done: ready.membership, label: t("stepMembership"), href: `/panel/${id}/membresia` },
    { done: ready.approved, label: t("stepReview") },
  ];
  const canSubmit = r.status === "draft" && ready.profile && ready.menu;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t("checklistTitle")}</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  s.done ? "bg-ok text-white" : "border-2 border-line text-muted"
                }`}
                aria-hidden="true"
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="flex-1">
                {s.href && !s.done ? (
                  <Link href={s.href} className="font-medium text-sea hover:underline">{s.label}</Link>
                ) : (
                  <span className={s.done ? "text-muted line-through decoration-muted/40" : "font-medium"}>{s.label}</span>
                )}
                {s.extra && <span className="ml-2 text-sm text-muted">({s.extra})</span>}
              </div>
            </li>
          ))}
        </ol>

        {(canSubmit || r.status === "pending_review") && (
          <form action={setReviewStatus.bind(null, id, r.status === "draft")} className="mt-6">
            <button className={r.status === "draft" ? "btn-primary" : "btn-secondary"}>
              {r.status === "draft" ? t("submitReview") : t("withdrawReview")}
            </button>
          </form>
        )}
      </section>

      <aside className="card space-y-2 p-5 text-sm">
        <p className="font-semibold">{t("nav.menu")}</p>
        <p className="text-3xl font-bold">{ready.menuCount}</p>
        <Link href={`/panel/${id}/menu`} className="btn-secondary w-full">{t("menu.add")}</Link>
      </aside>
    </div>
  );
}
