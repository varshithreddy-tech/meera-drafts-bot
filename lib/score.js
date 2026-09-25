import { callGemini } from "./gemini.js";
import { loadVoiceProfile } from "./voice.js";

// The scorecard. Each parameter is scored 1-10 by Gemini against the voice profile.
export const PARAMETERS = [
  {
    key: "faithfulness",
    name: "Faithful to the note",
    rubric: "Uses only facts, figures, events and claims present in the note. 10 = nothing invented or distorted. Any invented number, study, date or anecdote = 3 or lower. Reasons, opinions, positions, feelings or technical claims the note does not state also count as invention, even if plausible. If most of the draft is material not in the note = 4 or lower.",
  },
  {
    key: "opening",
    name: "Opening & sign-off",
    rubric: "Opens with a concrete scene or a direct statement of intent, with no pleasantries beyond \"Hi.\" Signs off simply as \"Meera\".",
  },
  {
    key: "rhythm",
    name: "Rhythm",
    rubric: "Alternates longer explanatory sentences with short, flat verdicts (e.g. \"This is legal. It is also not helpful.\"). Low if every sentence has the same length or it reads choppy throughout.",
  },
  {
    key: "precision",
    name: "Precision & evidence",
    rubric: "Keeps the exact figures from the note and grades evidence honestly (solid vs thinner). Low if figures are rounded, vague or dropped, or evidence is overstated. If the note has no figures or evidence, judge whether the draft stays concrete rather than vague.",
  },
  {
    key: "restraint",
    name: "No hype or selling",
    rubric: "No hype words, exclamation marks, sensory beauty language like \"glow\", overclaiming, or sales pitch. Disclaims sales motive or expertise where the topic invites it.",
  },
  {
    key: "accountability",
    name: "Ownership & boundaries",
    rubric: "Owns mistakes, delay and discomfort plainly; never blames individuals or teams; personal only about work, with no family or private-life detail.",
  },
];

const VERDICTS = [
  { min: 8, label: "Ready to post" },
  { min: 6, label: "Needs light edits" },
  { min: 0, label: "Rewrite" },
];

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scores: {
      type: "OBJECT",
      properties: Object.fromEntries(PARAMETERS.map((p) => [p.key, { type: "INTEGER" }])),
      required: PARAMETERS.map((p) => p.key),
    },
    fixes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["scores", "fixes"],
};

function scorerInstruction() {
  return [
    "You are a strict editor reviewing a draft post written in the voice of Meera Pillai, founder of Skinstinct.",
    "Compare the draft against her voice profile and the original note, then score each parameter from 1 to 10.",
    "Be critical: 10 means nothing to improve. Do not give high scores by default.",
    "",
    "<voice_profile>",
    loadVoiceProfile(),
    "</voice_profile>",
    "",
    "Parameters:",
    ...PARAMETERS.map((p) => `- ${p.key} (${p.name}): ${p.rubric}`),
    "",
    "In \"fixes\", list up to 3 specific, concrete edits that would most improve the draft, quoting the words to change. Return an empty list if the draft needs no changes.",
  ].join("\n");
}

export async function scoreDraft(note, draft) {
  const raw = await callGemini({
    system: scorerInstruction(),
    user: `<note>\n${note}\n</note>\n\n<draft>\n${draft}\n</draft>`,
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  });
  const { scores, fixes } = JSON.parse(raw);

  for (const p of PARAMETERS) {
    scores[p.key] = Math.min(10, Math.max(1, Math.round(Number(scores[p.key]) || 1)));
  }

  // Overall = average, but an invented fact caps the score: a well-styled post with made-up claims isn't publishable.
  const avg = PARAMETERS.reduce((sum, p) => sum + scores[p.key], 0) / PARAMETERS.length;
  const overall = Math.round(Math.min(avg, scores.faithfulness <= 5 ? scores.faithfulness : 10) * 10) / 10;
  const verdict = VERDICTS.find((v) => overall >= v.min).label;

  return { overall, verdict, scores, fixes: (fixes || []).slice(0, 3) };
}

export function formatScorecard({ overall, verdict, scores, fixes }) {
  const lines = [
    `Draft score: ${overall}/10 - ${verdict}`,
    "",
    ...PARAMETERS.map((p) => `${scores[p.key]}/10  ${p.name}`),
  ];
  if (fixes.length) lines.push("", "Suggested fixes:", ...fixes.map((f) => `- ${f}`));
  return lines.join("\n");
}
