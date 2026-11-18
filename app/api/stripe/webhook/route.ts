import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";
import { HANDLED_EVENTS, subscriptionIdFromEvent } from "@/lib/billing";
import { syncSubscription } from "@/lib/billing-sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, serverEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) return NextResponse.json({ received: true, ignored: event.type });

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) return NextResponse.json({ received: true, ignored: "no subscription" });

  try {
    const row = await syncSubscription(subscriptionId);
    return NextResponse.json({ received: true, status: row.status });
  } catch (e) {
    console.error("stripe webhook sync failed", event.id, e);
    // 500 makes Stripe retry with backoff.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
