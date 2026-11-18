import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getManagedRestaurant } from "@/lib/panel";
import { stripeConfigured } from "@/lib/stripe";
import { PRICING, formatUsd } from "@/lib/pricing";

const ACTIVE = ["active", "trialing", "past_due"];

export default async function MembershipPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [r, t, to, format, sp] = await Promise.all([
    getManagedRestaurant(locale, id),
    getTranslations("panel.billing"),
    getTranslations("owners"),
    getFormatter(),
    searchParams,
  ]);
  const sub = r.subscriptions;
  const active = sub && ACTIVE.includes(sub.status);
  const configured = stripeConfigured();
  const statusKey = (sub?.status ?? "none") as Parameters<typeof t>[0];
  const date = sub?.current_period_end ? format.dateTime(new Date(sub.current_period_end), { dateStyle: "long" }) : null;

  return (
    <div className="space-y-6">
      {sp.checkout === "success" && <Notice tone="ok">{t("success")}</Notice>}
      {sp.checkout === "canceled" && <Notice tone="warn">{t("canceledCheckout")}</Notice>}
      {(sp.error === "config" || !configured) && <Notice tone="warn">{t("notConfigured")}</Notice>}
      {sub?.status === "past_due" && <Notice tone="warn">{t("pastDueWarning")}</Notice>}

      <section className="card p-5 sm:p-6">
        <p className="text-sm text-muted">{t("statusLabel")}</p>
        <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-ok" : "bg-muted/40"}`} aria-hidden="true" />
          {t.has(statusKey) ? t(statusKey) : sub?.status}
        </p>
        {active && date && (
          <p className="mt-1 text-sm text-muted">{sub.cancel_at_period_end ? t("ends", { date }) : t("renews", { date })}</p>
        )}
        {sub?.stripe_customer_id && configured && (
          <form action="/api/stripe/portal" method="post" className="mt-4">
            <input type="hidden" name="restaurantId" value={id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="btn-secondary">{t("manage")}</button>
          </form>
        )}
      </section>

      {!active && (
        <section>
          <h2 className="text-lg font-semibold">{t("choosePlan")}</h2>
          <p className="text-sm text-muted">{to("trial", { days: PRICING.trialDays })}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["monthly", "yearly"] as const).map((plan) => (
              <form key={plan} action="/api/stripe/checkout" method="post" className={`card flex flex-col p-5 ${plan === "yearly" ? "border-2 border-brand" : ""}`}>
                <input type="hidden" name="restaurantId" value={id} />
                <input type="hidden" name="plan" value={plan} />
                <input type="hidden" name="locale" value={locale} />
                <p className="font-semibold">
                  {to(plan)}
                  {plan === "yearly" && <span className="badge ml-2 bg-brand-soft text-brand">{to("yearlySaving")}</span>}
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {formatUsd(PRICING[plan], locale)}
                  <span className="text-base font-normal text-muted">{plan === "monthly" ? to("perMonth") : to("perYear")}</span>
                </p>
                <button className="btn-primary mt-4" disabled={!configured}>{t("subscribe")}</button>
              </form>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">{to("foundingNote")}</p>
        </section>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
      {children}
    </p>
  );
}
