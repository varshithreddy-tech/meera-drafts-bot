// Local testing without Vercel: pulls messages from Telegram and feeds them
// through the same handler the webhook uses. Stop with Ctrl+C.
// Usage: npm run dev
import handler from "../api/telegram.js";
import { telegramApi } from "../lib/telegram.js";

const hook = await telegramApi("getWebhookInfo", {});
if (hook.url) {
  console.error(`A webhook is set (${hook.url}). Polling won't work while it is.`);
  console.error("Remove it with: npm run delete-webhook  (then re-run set-webhook when done)");
  process.exit(1);
}

// The handler checks the webhook secret header; supply it so local requests pass.
const headers = { "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET };

function fakeRes() {
  return { status() { return this; }, json() { return this; }, send() { return this; } };
}

const me = await telegramApi("getMe", {});
console.log(`Polling as @${me.username}. Send it a message in Telegram.`);

let offset = 0;
while (true) {
  try {
    const updates = await telegramApi("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
    for (const update of updates) {
      offset = update.update_id + 1;
      const m = update.message;
      console.log(`[${m?.chat?.id}] ${m?.text ?? "(non-text)"}`);
      await handler({ method: "POST", headers, body: update }, fakeRes());
      console.log("  -> replied");
    }
  } catch (err) {
    console.error(err.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
