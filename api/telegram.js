import { generateDraft } from "../lib/gemini.js";
import { scoreDraft, formatScorecard } from "../lib/score.js";
import { sendMessage, sendTyping } from "../lib/telegram.js";
import { triageNote, formatRejection } from "../lib/triage.js";

function allowedChats() {
  return (process.env.ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Meera drafts bot is running.");
  }

  // Reject requests that don't come from Telegram (secret set via setWebhook).
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).send("Unauthorized");
  }

  const message = req.body?.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  // Ignore non-message updates and non-text messages (stickers, photos, etc.).
  if (!chatId) return res.status(200).json({ ok: true });

  try {
    if (text === "/start" || text === "/id") {
      await sendMessage(
        chatId,
        `Hi. Send me a note and I'll send back a draft post.\n\nNotes are scored first; thin ones come back with what to add. Send /draft followed by a note to skip that check.\n\nYour chat ID is ${chatId}`
      );
      return res.status(200).json({ ok: true });
    }

    const allowed = allowedChats();
    if (allowed.length && !allowed.includes(String(chatId))) {
      return res.status(200).json({ ok: true });
    }

    if (!text) {
      await sendMessage(chatId, "Please send the note as a text message.");
      return res.status(200).json({ ok: true });
    }

    // "/draft <note>" skips the triage check.
    const forced = /^\/draft\b/i.test(text);
    const note = forced ? text.replace(/^\/draft\b/i, "").trim() : text;
    if (!note) {
      await sendMessage(chatId, "Send /draft followed by the note, e.g. /draft thinking about fragrance free");
      return res.status(200).json({ ok: true });
    }

    // Vercel freezes the function once the response is sent, so finish all work first.
    await sendTyping(chatId);

    let noteLine = forced ? "Note score: skipped (/draft)" : null;
    if (!forced) {
      try {
        const triage = await triageNote(note);
        if (!triage.passed) {
          await sendMessage(chatId, formatRejection(triage), message.message_id);
          return res.status(200).json({ ok: true });
        }
        noteLine = `Note score: ${triage.score}/10`;
      } catch (err) {
        // A triage failure shouldn't block drafting.
        console.error("Triage failed:", err);
        noteLine = "Note score: unavailable";
      }
      await sendTyping(chatId);
    }

    const draft = await generateDraft(note);
    await sendMessage(chatId, draft, message.message_id);

    // Scorecard goes in its own message so the draft stays clean to copy.
    try {
      await sendTyping(chatId);
      await sendMessage(chatId, `${noteLine}\n${formatScorecard(await scoreDraft(note, draft))}`);
    } catch (err) {
      console.error("Scoring failed:", err);
      await sendMessage(chatId, "(Couldn't score this draft.)").catch(() => {});
    }
  } catch (err) {
    console.error(err);
    await sendMessage(chatId, "Sorry, I couldn't generate a draft for that note. Please try again.").catch(() => {});
  }

  // Always 200 so Telegram doesn't retry and produce duplicate drafts.
  return res.status(200).json({ ok: true });
}
