import Stripe from "stripe";
import { config } from "./config.js";

export const stripe = new Stripe(config.STRIPE_SECRET_KEY);

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Create a Stripe Checkout Session for a single user. We pass the Telegram
 * user id as `client_reference_id` so the webhook can map the payment back to
 * the user and auto-grant access.
 */
export async function createCheckoutSession(userId: number, username?: string): Promise<CheckoutResult> {
  const priceInCents = config.PRICE_AMOUNT;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: String(userId),
    metadata: {
      telegram_user_id: String(userId),
      username: username ?? "",
    },
    line_items: [
      {
        price_data: {
          currency: config.CURRENCY.toLowerCase(),
          unit_amount: priceInCents,
          product_data: {
            name: config.PLAN_TITLE,
            description: config.PLAN_DESCRIPTION,
          },
        },
        quantity: 1,
      },
    ],
    success_url: config.PAYMENT_SUCCESS_URL || "https://t.me",
    cancel_url: "https://t.me",
  });

  return { url: session.url!, sessionId: session.id };
}
