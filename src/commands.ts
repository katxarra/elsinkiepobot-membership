import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { isActive, getMembership, isAdmin, revokeMembership } from "./store.js";
import { sendSubscribePrompt } from "./payments.js";
import { grantAccess } from "./membership.js";

/** main keyboard shown after /start */
function mainKeyboard(active: boolean) {
  const kb = new InlineKeyboard();
  if (active) {
    kb.text("🌐 Unirme al grupo", "join");
    kb.text("💳 Renovar", "pay");
    kb.row();
    kb.text("📅 Mi estado", "status");
  } else {
    kb.text("💳 Suscribirse", "pay");
    kb.row();
    kb.text("ℹ️ Cómo funciona", "how");
  }
  return kb;
}

export function registerCommands(bot: Bot) {
  bot.command("start", async (ctx) => {
    const active = isActive(ctx.from!.id);
    await ctx.reply(
      active
        ? `¡Bienvenido de nuevo! Tu membresía está activa.`
        : `👋 ¡Bienvenido a ${config.PLAN_TITLE}!\n\nObtén acceso al grupo privado por ${formatPrice()}/${config.PLAN_DAYS} días.\n\nUsa el botón de abajo para suscribirte.`,
      { reply_markup: mainKeyboard(active) }
    );
  });

  bot.command("subscribe", async (ctx) => {
    if (isActive(ctx.from!.id)) {
      const m = getMembership(ctx.from!.id)!;
      return ctx.reply(
        `Ya tienes una membresía activa hasta ${new Date(m.expiresAt).toISOString()}.\nRenueva para extenderla.`,
        { reply_markup: new InlineKeyboard().text("💳 Renovar", "pay") }
      );
    }
    await sendSubscribePrompt(bot, ctx.chat!.id, ctx.from!.id, ctx.from!.username);
  });

  bot.command("status", async (ctx) => {
    const active = isActive(ctx.from!.id);
    const m = getMembership(ctx.from!.id);
    await ctx.reply(
      active
        ? `✅ Activa — tu ${config.PLAN_TITLE} es válida hasta ${new Date(m!.expiresAt).toISOString()}.`
        : `❌ Sin membresía activa. Usa /subscribe para obtener acceso.`,
      { reply_markup: new InlineKeyboard().text("💳 Suscribirse", "pay") }
    );
  });

  bot.command("join", async (ctx) => {
    if (!isActive(ctx.from!.id)) {
      return ctx.reply("Necesitas una membresía activa. Usa /subscribe primero.", {
        reply_markup: new InlineKeyboard().text("💳 Suscribirse", "pay"),
      });
    }
    await grantAccess(bot, ctx.from!.id);
  });

  // ---- Admin commands ----
  bot.command("grant", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    const uid = Number(ctx.match.trim());
    if (!Number.isInteger(uid)) return ctx.reply("Uso: /grant <user_id>");
    const ok = await grantAccess(bot, uid);
    await ctx.reply(ok ? `Acceso concedido al usuario ${uid}.` : "No se pudo otorgar acceso.");
  });

  bot.command("revoke", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    const uid = Number(ctx.match.trim());
    if (!Number.isInteger(uid)) return ctx.reply("Uso: /revoke <user_id>");
    const ok = revokeMembership(uid);
    await ctx.reply(ok ? `Usuario ${uid} revocado.` : `Sin membresía para ${uid}.`);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Comandos:\n" +
        "/start — empezar\n" +
        "/subscribe — comprar una membresía\n" +
        "/status — ver tu membresía\n" +
        "/join — obtener el enlace de invitación\n" +
        (isAdmin(ctx.from!.id) ? "/grant <user_id> — admin: dar acceso\n/revoke <user_id> — admin: revocar\n" : "")
    );
  });
}

export function registerCallbacks(bot: Bot) {
  bot.callbackQuery("pay", async (ctx) => {
    const from = ctx.callbackQuery.from;
    if (isActive(from.id)) {
      await ctx.answerCallbackQuery();
      return ctx.reply("Ya tienes una membresía activa.", {
        reply_markup: new InlineKeyboard().text("💳 Renovar", "pay"),
      });
    }
    await ctx.answerCallbackQuery("Abriendo checkout…");
    await sendSubscribePrompt(bot, ctx.chat!.id, from.id, from.username);
  });

  bot.callbackQuery("status", async (ctx) => {
    const active = isActive(ctx.callbackQuery.from.id);
    const m = getMembership(ctx.callbackQuery.from.id);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      active
        ? `✅ Activa — válida hasta ${new Date(m!.expiresAt).toISOString()}.`
        : `❌ Sin membresía activa.`,
      { reply_markup: new InlineKeyboard().text("💳 Suscribirse", "pay") }
    );
  });

  bot.callbackQuery("join", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isActive(ctx.callbackQuery.from.id)) {
      return ctx.reply("Necesitas una membresía activa. Usa /subscribe primero.", {
        reply_markup: new InlineKeyboard().text("💳 Suscribirse", "pay"),
      });
    }
    await grantAccess(bot, ctx.callbackQuery.from.id);
  });

  bot.callbackQuery("how", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💰 Suscripción: ${formatPrice()} por ${config.PLAN_DAYS} días.\n\n` +
        `Después de pagar a través del checkout seguro, recibirás una invitación al grupo privado.`
    );
  });
}

function formatPrice() {
  const amount = config.PRICE_AMOUNT / 100;
  return `${new Intl.NumberFormat("en-US", { style: "currency", currency: config.CURRENCY }).format(amount)}`;
}
