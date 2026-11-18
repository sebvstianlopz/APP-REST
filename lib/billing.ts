import type Stripe from "stripe";

export interface SubscriptionRow {
  restaurant_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  price_id: string | null;
  status: Stripe.Subscription.Status;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/**
 * Map a Stripe subscription onto our `subscriptions` row. Newer Stripe API
 * versions moved `current_period_end` onto the subscription items, so read
 * either location.
 */
export function subscriptionToRow(sub: Stripe.Subscription, restaurantId: string): SubscriptionRow {
  const item = sub.items?.data?.[0];
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const itemEnd = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  const end = itemEnd ?? legacyEnd ?? null;
  return {
    restaurant_id: restaurantId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    price_id: item?.price?.id ?? null,
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  };
}

/** Stripe event types the webhook acts on. */
export const HANDLED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

/** Extract the subscription id an event refers to (if any). */
export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) return obj.id as string;
  if (event.type === "checkout.session.completed") {
    const s = obj.subscription;
    return typeof s === "string" ? s : ((s as { id?: string } | null)?.id ?? null);
  }
  if (event.type.startsWith("invoice.")) {
    // Location moved between API versions: invoice.subscription -> invoice.parent.subscription_details.subscription
    const direct = obj.subscription;
    const nested = (obj.parent as { subscription_details?: { subscription?: unknown } } | undefined)?.subscription_details?.subscription;
    const s = direct ?? nested;
    return typeof s === "string" ? s : ((s as { id?: string } | null)?.id ?? null);
  }
  return null;
}
