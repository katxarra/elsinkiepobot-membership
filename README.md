# Telegram Membership Bot

A Telegram bot that sells **membership to a private group/channel** using **Stripe Checkout** (pay by card, worldwide). After a successful payment, the bot automatically grants the user access to your target group via a Stripe webhook.

Built with **Node.js + TypeScript + grammY + Stripe**.

---

## Features

- `/start`, `/subscribe`, `/status`, `/join`, `/help` commands
- Inline keyboard for a friendly mobile UI
- **/subscribe** sends the checkout prompt:
  > _Ya casi estamos. Solo falta un paso._
  > _Haz click en el botón de abajo y serás redirigido a Stripe, para pagar con tarjeta_
- Stripe Checkout (card payments) — `Pay with card` button opens a secure Stripe page
- Automatic access grant on payment (Stripe webhook):
  - **invite_link** — sends a one-time, 24h invite link to the buyer
  - **approve** — auto-approves the buyer's join request (for join-by-request groups)
- JSON-file persistence of memberships (no database needed)
- Admin commands: `/grant <user_id>` and `/revoke <user_id>`

---

## Setup

### 1. Create the bot

1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, pick a name + username, save the **token**.

### 2. Set up Stripe (your own account)

1. Create an account at [dashboard.stripe.com](https://dashboard.stripe.com) (works worldwide, including the UK).
2. Go to **Developers → API keys** and copy your **secret key** (`sk_test_...`).
3. (Optional, for auto-grant) In Stripe **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://YOUR-APP-URL/webhook`
   - Events: `checkout.session.completed`
   - Copy the **signing secret** (`whsec_...`).

### 3. Prepare your group

1. Create the private group/channel you want to sell access to.
2. Add your bot as **admin**.
   - For **invite_link**: the bot needs *Invite links* permission.
   - For **approve**: the bot needs *Manage members / approve join requests* and the group must be *join-by-request* only.
3. Copy the group's **ID** (`-100...`) or `@username`.

### 4. Configure

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

> **Important:** secrets (bot token, Stripe key, webhook secret) are secret. `.env` is git-ignored.

```env
BOT_TOKEN=123456:ABC-DEF...
STRIPE_SECRET_KEY=sk_XXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXX
TARGET_CHAT_ID=-1001234567890
ADMIN_IDS=123456789
PRICE_AMOUNT=500                 # $5.00 in cents
CURRENCY=USD
PLAN_DAYS=30
GRANT_METHOD=invite_link         # or "approve"
BASE_URL=https://mybot.fly.dev   # used for the Stripe webhook
PAYMENT_SUCCESS_URL=https://t.me/elsinkiepobot
```

### 5. Run locally

```bash
npm install
npm run dev        # uses tsx, reloads on change
```

For production:

```bash
npm run build
npm run serve
```

---

## Commands

| Command | Who | Description |
|---------|-----|-------------|
| `/start` | everyone | Greeting + main menu |
| `/subscribe` | everyone | Send the Stripe checkout prompt |
| `/status` | everyone | Show membership status |
| `/join` | member | Get the invite link |
| `/help` | everyone | List commands |
| `/grant <user_id>` | admin | Grant access manually |
| `/revoke <user_id>` | admin | Revoke a membership |

---

## How it works

1. User taps **Suscribirse** or runs `/subscribe`.
2. The bot creates a Stripe **Checkout Session** for that user.
3. The bot sends a message + a **Pay with card** button linking to Stripe.
4. The buyer pays on the Stripe page (card); Stripe charges the card.
5. Stripe fires a `checkout.session.completed` webhook to `/webhook`.
6. The bot verifies the webhook, records the membership (with expiry), and grants access to the target group (invite link or join approval).

> **No webhook configured?** Set `STRIPE_WEBHOOK_SECRET` to empty — the bot still takes payments, but you grant access manually with `/grant <user_id>`.

---

## Deployment (24/7) with Fly.io

This repo includes a `Dockerfile` and `fly.toml` for free hosting on [Fly.io](https://fly.io) (bot runs 24/7, exposes port `8080` for the Stripe webhook, and persists memberships in a volume).

### One-time setup

1. Install the [Fly CLI](https://fly.io/docs/flyctl/install/), then log in:
   ```bash
   fly auth login
   ```
2. Create the app and its data volume (if you changed the name, edit `fly.toml` first):
   ```bash
   fly launch --no-deploy
   fly volumes create membership_data --region lhr --size 1
   ```
3. Set your secrets (never put these in the repo):
   ```bash
   fly secrets set BOT_TOKEN="123456:ABC-DEF..." \
     STRIPE_SECRET_KEY="sk_test_..." \
     STRIPE_WEBHOOK_SECRET="whsec_..." \
     TARGET_CHAT_ID="-1001234567890" \
     ADMIN_IDS="123456789" \
     BASE_URL="app" \
     PAYMENT_SUCCESS_URL="https://t.me/elsinkiepobot"
   ```
4. Deploy:
   ```bash
   fly deploy --ha=false
   ```
5. The app is now live at `https://<app-name>.fly.dev`.

### Wire up the Stripe webhook

Since the bot uses long polling, Stripe needs a public URL to send webhooks:
- In Stripe **Developers → Webhooks → Add endpoint**: `https://<app-name>.fly.dev/webhook`
- Select event: `checkout.session.completed`
- Copy the **signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` (step 3) and check the health endpoint: `https://<app-name>.fly.dev/health` returns `ok`.

### Optional local run with Docker
```bash
docker build -t membership-bot .
docker run --rm -p 8080:8080 --env-file .env membership-bot
```

---

## Notes

- Data is stored in `data/store.json` (created on first write). Replace the JSON store with a real DB (e.g. Postgres/Redis) for heavy traffic.
- Use `sk_test_...` + test cards first, then switch to `sk_live_...` for real payments.
