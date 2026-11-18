import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { env, serverEnv, trialDays } from "@/lib/env";

export const runtime = "nodejs";

/** POST form: restaurantId, plan (monthly|yearly), locale -> redirect to Stripe Checkout. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const restaurantId = String(form.get("restaurantId") ?? "");
  const plan = form.get("plan") === "yearly" ? "yearly" : "monthly";
  const locale = form.get("locale") === "en" ? "en" : "es";
  const back = (q: string) => NextResponse.redirect(`${env.siteUrl}/${locale}/panel/${restaurantId}/membresia?${q}`, 303);

  if (!stripeConfigured()) return back("error=config");

  // Authorise with the user's own session: RLS only returns restaurants they manage.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${env.siteUrl}/${locale}/entrar`, 303);
  const { data: restaurant } = await supabase.from("restaurants").select("id, name").eq("id", restaurantId).maybeSingle();
  if (!restaurant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stripe = getStripe();
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  // Already paying? Send them to the billing portal instead of a second subscription.
  if (existing?.stripe_customer_id && ["active", "trialing", "past_due"].includes(existing.status)) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: existing.stripe_customer_id,
      return_url: `${env.siteUrl}/${locale}/panel/${restaurant.id}/membresia`,
    });
    return NextResponse.redirect(portal.url, 303);
  }

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.user.email,
      name: restaurant.name,
      preferred_locales: [locale],
      metadata: { restaurant_id: restaurant.id, user_id: auth.user.id },
    });
    customerId = customer.id;
    await admin
      .from("subscriptions")
      .upsert({ restaurant_id: restaurant.id, stripe_customer_id: customerId, status: "incomplete" }, { onConflict: "restaurant_id" });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: restaurant.id,
    line_items: [{ price: serverEnv(plan === "yearly" ? "STRIPE_PRICE_YEARLY" : "STRIPE_PRICE_MONTHLY"), quantity: 1 }],
    subscription_data: {
      metadata: { restaurant_id: restaurant.id },
      // Free trial only if this restaurant never had a subscription (an abandoned checkout doesn't count).
      ...(!existing?.stripe_subscription_id && trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    allow_promotion_codes: true, // e.g. "founding member" coupons
    locale,
    success_url: `${env.siteUrl}/${locale}/panel/${restaurant.id}/membresia?checkout=success`,
    cancel_url: `${env.siteUrl}/${locale}/panel/${restaurant.id}/membresia?checkout=canceled`,
  });
  return NextResponse.redirect(session.url!, 303);
}
