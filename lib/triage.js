import { callGemini } from "./gemini.js";
import { loadVoiceProfile } from "./voice.js";

// Scores the raw note 0-10 for publishability before any draft is written.
export const CRITERIA = [
  {
    key: "substance",
    name: "Clear point",
    rubric: "Is there one clear idea, lesson, decision or story worth a post? 0 = just a topic or a passing thought.",
  },
  {
    key: "specificity",
    name: "Concrete material",
    rubric: "Does the note contain specifics a post can be built on: figures, events, places, dates, a decision, a mistake? 0 = nothing concrete.",
  },
  {
    key: "value",
    name: "Reader value",
    rubric: "Would customers or people in the skincare industry learn something or trust Skinstinct more after reading it?",
  },
  {
    key: "fit",
    name: "Fits Meera's voice",
    rubric: "Can this be written in her voice without breaking it? Low if it is mainly hype, a sales push, or about her private or family life.",
  },
];

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scores: {
      type: "OBJECT",
      properties: Object.fromEntries(CRITERIA.map((c) => [c.key, { type: "INTEGER" }])),
      required: CRITERIA.map((c) => c.key),
    },
    missing: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["scores", "missing"],
};

function minScore() {
  const n = Number(process.env.NOTE_MIN_SCORE);
  return Number.isFinite(n) ? n : 5;
}

function triageInstruction() {
  return [
    "You screen rough notes from Meera Pillai, founder of Skinstinct, before they are turned into social posts in her voice.",
    "Judge only the note itself: is there enough here to write a good post? Score each criterion from 0 to 10. Be strict.",
    "",
    "<voice_profile>",
    loadVoiceProfile(),
    "</voice_profile>",
    "",
    "Criteria:",
    ...CRITERIA.map((c) => `- ${c.key} (${c.name}): ${c.rubric}`),
    "",
    "In \"missing\", list up to 3 short, specific things Meera could add to the note to make it publishable (e.g. \"the actual return rate\", \"what you decided to do about it\"). Empty list if nothing is missing.",
  ].join("\n");
}

export async function triageNote(note) {
  const raw = await callGemini({
    system: triageInstruction(),
    user: `<note>\n${note}\n</note>`,
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  });
  const { scores, missing } = JSON.parse(raw);

  for (const c of CRITERIA) {
    scores[c.key] = Math.min(10, Math.max(0, Math.round(Number(scores[c.key]) || 0)));
  }
  const score = Math.round((CRITERIA.reduce((sum, c) => sum + scores[c.key], 0) / CRITERIA.length) * 10) / 10;

  return { score, passed: score >= minScore(), scores, missing: (missing || []).slice(0, 3) };
}

export function formatRejection({ score, scores, missing }) {
  const lines = [
    `Note score: ${score}/10 - not enough to draft yet (needs ${minScore()}+).`,
    "",
    ...CRITERIA.map((c) => `${scores[c.key]}/10  ${c.name}`),
  ];
  if (missing.length) lines.push("", "What would help:", ...missing.map((m) => `- ${m}`));
  lines.push("", "Add more and resend, or send /draft followed by the note to draft it anyway.");
  return lines.join("\n");
}
