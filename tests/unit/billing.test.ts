import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { HANDLED_EVENTS, subscriptionIdFromEvent, subscriptionToRow } from "@/lib/billing";

const baseSub = {
  id: "sub_123",
  object: "subscription",
  customer: "cus_123",
  status: "trialing",
  cancel_at_period_end: false,
  metadata: { restaurant_id: "r1" },
  items: { data: [{ price: { id: "price_monthly" }, current_period_end: 1_900_000_000 }] },
} as unknown as Stripe.Subscription;

describe("subscriptionToRow", () => {
  it("maps a subscription (period end on the item, current API versions)", () => {
    expect(subscriptionToRow(baseSub, "r1")).toEqual({
      restaurant_id: "r1",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      price_id: "price_monthly",
      status: "trialing",
      current_period_end: new Date(1_900_000_000 * 1000).toISOString(),
      cancel_at_period_end: false,
    });
  });
  it("supports the legacy top-level period end and expanded customers", () => {
    const legacy = {
      ...baseSub,
      customer: { id: "cus_x" },
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: "p" } }] },
    } as unknown as Stripe.Subscription;
    const row = subscriptionToRow(legacy, "r1");
    expect(row.stripe_customer_id).toBe("cus_x");
    expect(row.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });
});

describe("subscriptionIdFromEvent", () => {
  const ev = (type: string, object: object) => ({ type, data: { object } }) as unknown as Stripe.Event;
  it("finds the subscription in each event shape", () => {
    expect(subscriptionIdFromEvent(ev("customer.subscription.updated", { id: "sub_1" }))).toBe("sub_1");
    expect(subscriptionIdFromEvent(ev("checkout.session.completed", { subscription: "sub_2" }))).toBe("sub_2");
    expect(subscriptionIdFromEvent(ev("invoice.payment_failed", { subscription: "sub_3" }))).toBe("sub_3");
    expect(
      subscriptionIdFromEvent(ev("invoice.paid", { parent: { subscription_details: { subscription: "sub_4" } } })),
    ).toBe("sub_4");
    expect(subscriptionIdFromEvent(ev("checkout.session.completed", { subscription: null }))).toBeNull();
  });
  it("handles every event the webhook subscribes to", () => {
    expect(HANDLED_EVENTS.has("customer.subscription.deleted")).toBe(true);
    expect(HANDLED_EVENTS.has("charge.succeeded")).toBe(false);
  });
});

describe("webhook signature verification", () => {
  const stripe = new Stripe("sk_test_dummy");
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });

  it("accepts a correctly signed payload", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, header, secret).id).toBe("evt_1");
  });
  it("rejects a tampered payload or wrong secret", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload.replace("sub_1", "sub_X"), header, secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow();
  });
});
