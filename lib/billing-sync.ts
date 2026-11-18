import "server-only";
import { createAdminClient } from "./supabase/admin";
import { getStripe } from "./stripe";
import { subscriptionToRow } from "./billing";

/**
 * Re-read a subscription from Stripe (so out-of-order webhooks can't apply
 * stale state) and mirror it into our database. The DB trigger then
 * recomputes whether the restaurant is listed.
 */
export async function syncSubscription(subscriptionId: string) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  let restaurantId = sub.metadata?.restaurant_id;
  if (!restaurantId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const { data } = await admin.from("subscriptions").select("restaurant_id").eq("stripe_customer_id", customerId).maybeSingle();
    restaurantId = data?.restaurant_id;
  }
  if (!restaurantId) throw new Error(`No restaurant for subscription ${subscriptionId}`);

  const row = subscriptionToRow(sub, restaurantId);
  const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "restaurant_id" });
  if (error) throw error;

  // First successful membership: put a draft in the review queue automatically.
  if (["active", "trialing"].includes(row.status)) {
    await admin.from("restaurants").update({ status: "pending_review" }).eq("id", restaurantId).eq("status", "draft");
  }
  return row;
}
