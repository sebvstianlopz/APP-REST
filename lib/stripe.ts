import "server-only";
import Stripe from "stripe";
import { serverEnv } from "./env";

let stripe: Stripe | undefined;

export function getStripe() {
  stripe ??= new Stripe(serverEnv("STRIPE_SECRET_KEY"), { appInfo: { name: "Antojo PR" } });
  return stripe;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY);
}
