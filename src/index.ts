import { createServer } from "node:http";
import { Bot } from "grammy";
import { config } from "./config.js";
import { registerCommands, registerCallbacks } from "./commands.js";
import { handleStripeEvent } from "./payments.js";
import { stripe } from "./stripe.js";

const bot = new Bot(config.BOT_TOKEN);

registerCommands(bot);
registerCallbacks(bot);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

// ---- HTTP server: Stripe webhook (auto-grant) + health check for hosting ----
const PORT = Number(process.env.PORT ?? 8080);

const server = createServer((req, res) => {
  const url = (req.url ?? "").split("?")[0];

  if (req.method === "GET" && url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }

  if (req.method === "POST" && url === "/webhook") {
    if (!config.STRIPE_WEBHOOK_SECRET) {
      res.writeHead(404).end("webhook not configured");
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", async () => {
      try {
        const sig = req.headers["stripe-signature"] as string;
        const event = stripe.webhooks.constructEvent(raw, sig, config.STRIPE_WEBHOOK_SECRET);
        await handleStripeEvent(bot, event);
        res.writeHead(200).end("ok");
      } catch (err) {
        console.error("Stripe webhook error:", err);
        res.writeHead(400).end("bad request");
      }
    });
    return;
  }

  res.writeHead(404).end("not found");
});
server.listen(PORT, () => console.log(`HTTP server listening on :${PORT}`));

// Graceful shutdown for deployments that terminate the process.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    bot.stop();
    process.exit(0);
  });
}

async function main() {
  console.log(`Bot starting… (${config.GRANT_METHOD} grant, ${config.CURRENCY} ${config.PRICE_AMOUNT}/100)`);
  await bot.start({
    onStart: (info) => console.log(`@${info.username} is up!`),
  });
}

main();
