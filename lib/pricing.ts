/** Display prices for the membership (must match the Stripe prices configured in env). */
export const PRICING = {
  monthly: Number(process.env.NEXT_PUBLIC_PRICE_MONTHLY_USD ?? 29),
  yearly: Number(process.env.NEXT_PUBLIC_PRICE_YEARLY_USD ?? 290),
  trialDays: Number(process.env.NEXT_PUBLIC_TRIAL_DAYS ?? process.env.STRIPE_TRIAL_DAYS ?? 30),
};

export function formatUsd(n: number | null | undefined, locale: string) {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-PR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}
