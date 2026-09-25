// Usage:
//   npm run set-webhook -- https://your-project.vercel.app
//   npm run webhook-info
import { telegramApi } from "../lib/telegram.js";

const arg = process.argv[2];

if (arg === "--info") {
  console.log(await telegramApi("getWebhookInfo", {}));
} else if (arg === "--delete") {
  await telegramApi("deleteWebhook", {});
  console.log("Webhook removed.");
} else {
  if (!arg) {
    console.error("Pass your Vercel URL, e.g. npm run set-webhook -- https://your-project.vercel.app");
    process.exit(1);
  }
  const url = `${arg.replace(/\/+$/, "")}/api/telegram`;
  await telegramApi("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
    ...(process.env.TELEGRAM_WEBHOOK_SECRET ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET } : {}),
  });
  console.log(`Webhook set to ${url}`);
}
