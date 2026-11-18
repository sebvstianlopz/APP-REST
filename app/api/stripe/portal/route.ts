import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const restaurantId = String(form.get("restaurantId") ?? "");
  const locale = form.get("locale") === "en" ? "en" : "es";
  if (!stripeConfigured()) return NextResponse.redirect(`${env.siteUrl}/${locale}/panel/${restaurantId}/membresia?error=config`, 303);

  // RLS: owners can only read their own subscription row.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "not found" }, { status: 404 });

  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    locale,
    return_url: `${env.siteUrl}/${locale}/panel/${restaurantId}/membresia`,
  });
  return NextResponse.redirect(portal.url, 303);
}
