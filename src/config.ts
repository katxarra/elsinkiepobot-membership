import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  TARGET_CHAT_ID: z.string().min(1, "TARGET_CHAT_ID is required"),
  ADMIN_IDS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n))
    ),
  PRICE_AMOUNT: z.coerce.number().int().positive().default(500),
  CURRENCY: z.string().default("USD"),
  PLAN_DAYS: z.coerce.number().int().positive().default(30),
  PLAN_TITLE: z.string().default("Premium Membership"),
  PLAN_DESCRIPTION: z.string().default("Access to the private members group"),
  GRANT_METHOD: z.enum(["invite_link", "approve"]).default("invite_link"),
  // Public base URL where your bot is deployed, used to build the Stripe
  // webhook endpoint (e.g. https://mybot.fly.dev). Only needed if using
  // webhook-based auto-granting.
  BASE_URL: z.string().default(""),
  PAYMENT_SUCCESS_URL: z.string().default(""),
});

export const config = schema.parse(process.env);

export function resolveChatId(raw: string): string {
  const trimmed = raw.trim();
  if (/^-?\d+$/.test(trimmed)) return trimmed;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
