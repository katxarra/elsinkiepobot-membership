import { Bot, InlineKeyboard } from "grammy";
import type Stripe from "stripe";
import { createCheckoutSession } from "./stripe.js";
import { config } from "./config.js";
import { upsertMembership } from "./store.js";
import { grantAccess } from "./membership.js";

const SUBSCRIBE_TEXT =
  "Ya casi estamos. Solo falta un paso.\n\n" +
  "Haz click en el botón de abajo y serás redirigido a Stripe, para pagar con tarjeta";

export { SUBSCRIBE_TEXT };

export async function sendSubscribePrompt(bot: Bot, chatId: number, userId: number, username?: string) {
  const { url } = await createCheckoutSession(userId, username);
  const keyboard = new InlineKeyboard().url("💳 Pagar con tarjeta", url);
  await bot.api.sendMessage(chatId, SUBSCRIBE_TEXT, { reply_markup: keyboard });
}

export function buildSubscribeKeyboard() {
  return new InlineKeyboard().text("💳 Suscribirse", "pay");
}

/**
 * Handle a Stripe webhook event. On a successful checkout, record the
 * membership and grant access to the target chat.
 */
export async function handleStripeEvent(bot: Bot, event: Stripe.Event) {
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object as Stripe.Checkout.Session;

  const telegramUserId = Number(session.client_reference_id ?? session.metadata?.telegram_user_id);
  if (!Number.isInteger(telegramUserId)) {
    console.warn("checkout.session.completed without a telegram user id", session.id);
    return;
  }

  const membership = upsertMembership(telegramUserId, {
    plan: "membership-1",
    days: config.PLAN_DAYS,
  });

  try {
    await bot.api.sendMessage(
      telegramUserId,
      `💳 Pago recibido — ¡gracias! Tu ${config.PLAN_TITLE} está activo hasta ${new Date(
        membership.expiresAt
      ).toISOString()}.`
    );
  } catch (e) {
    console.warn("Could not notify buyer", e);
  }

  const link = await grantAccess(bot, telegramUserId);
  if (!link) {
    await bot.api
      .sendMessage(
        telegramUserId,
        "⚠️ Recibimos tu pago pero no pudimos darte acceso automáticamente. Contacta a un administrador."
      )
      .catch(() => {});
  }
}
