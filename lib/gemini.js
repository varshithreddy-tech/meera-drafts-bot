import { buildSystemInstruction } from "./voice.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function callGemini({ system, user, generationConfig }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || "unknown";
    throw new Error(`Gemini returned no text (reason: ${reason})`);
  }
  return text;
}

export async function generateDraft(note) {
  return callGemini({
    system: buildSystemInstruction(),
    user: `Here is my note:\n\n${note}`,
    generationConfig: { temperature: 0.7 },
  });
}
