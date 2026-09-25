const MAX_LEN = 4096; // Telegram's per-message limit

async function call(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  return data.result;
}

function chunk(text) {
  const parts = [];
  let rest = text;
  while (rest.length > MAX_LEN) {
    let cut = rest.lastIndexOf("\n", MAX_LEN);
    if (cut < MAX_LEN / 2) cut = MAX_LEN;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) parts.push(rest);
  return parts;
}

// Sent as plain text (no parse_mode) so stray * or _ in a draft can't break delivery.
export async function sendMessage(chatId, text, replyTo) {
  for (const [i, part] of chunk(text).entries()) {
    await call("sendMessage", {
      chat_id: chatId,
      text: part,
      ...(i === 0 && replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
    });
  }
}

export async function sendTyping(chatId) {
  await call("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

export { call as telegramApi };
