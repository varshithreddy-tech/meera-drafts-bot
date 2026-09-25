# Meera drafts bot

Meera sends a note to a Telegram bot. The bot sends the note to Gemini with her voice profile (`voice-skill.txt`) as the system instruction, then replies in the same chat with the draft post.

```
Telegram --webhook--> Vercel /api/telegram --> Gemini (system instruction = voice-skill.txt)
    ^                                                   |
    +------------------- draft post <-------------------+
```

## Files

| File | Purpose |
|---|---|
| `api/telegram.js` | Webhook endpoint Telegram calls for every message |
| `lib/gemini.js` | Calls the Gemini `generateContent` API |
| `lib/voice.js` | Reads `voice-skill.txt` on every request and builds the system instruction |
| `lib/telegram.js` | Sends replies (split at Telegram's 4096-char limit) |
| `voice-skill.txt` | Meera's voice profile. Edit and redeploy to change how drafts sound |
| `scripts/set-webhook.js` | Points the Telegram bot at your Vercel URL |
| `vercel.json` | 60s function timeout and bundles `voice-skill.txt` with the function |

## Deploy

1. **Push to GitHub and import into Vercel** (or run `npx vercel` in this folder). No build step is needed.
2. **Add environment variables** in Vercel > Project > Settings > Environment Variables. Copy the values from `.env.local`:
   - `TELEGRAM_BOT_TOKEN`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional, defaults to `gemini-3.8-flash`)
   - `NOTE_MIN_SCORE` (optional, defaults to `5`)
   - `TELEGRAM_WEBHOOK_SECRET`
   - `ALLOWED_CHAT_IDS` (fill in after step 4)
   
   Redeploy after adding them.
3. **Register the webhook** (Node 20+):
   ```bash
   npm run set-webhook -- https://your-project.vercel.app
   ```
   No Node installed? Use PowerShell instead, with the values from `.env.local`:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" -ContentType "application/json" -Body '{"url":"https://your-project.vercel.app/api/telegram","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message"],"drop_pending_updates":true}'
   ```
4. **Lock it to Meera.** Have her send `/start` to the bot. It replies with her chat ID. Put that in `ALLOWED_CHAT_IDS` on Vercel and redeploy. Until you do, the bot drafts for anyone who messages it.

Check the webhook status with `npm run webhook-info`. Errors appear in Vercel > Project > Logs.

## Note triage

Before drafting, each note is scored 0-10 for publishability (`lib/triage.js`), averaging four criteria:

| Criterion | What it checks |
|---|---|
| Clear point | One clear idea, lesson, decision or story, not just a topic |
| Concrete material | Figures, events, dates, a decision or a mistake to build on |
| Reader value | Customers or industry readers learn something or trust Skinstinct more |
| Fits Meera's voice | Not mainly hype, a sales push, or private life |

Notes below `NOTE_MIN_SCORE` (default 5) are not drafted; the bot replies with the scores and up to 3 things to add. Sending `/draft <note>` skips the check. If the triage call itself fails, the bot drafts anyway.

## Draft scorecard

After each draft, the bot sends a second message scoring it 1-10 against the voice profile (`lib/score.js`):

| Parameter | What it checks |
|---|---|
| Faithful to the note | No invented facts, figures, studies or anecdotes |
| Opening & sign-off | Opens with a scene or direct statement; signs off "Meera" |
| Rhythm | Long explanations alternating with short, flat verdicts |
| Precision & evidence | Exact figures kept; evidence graded honestly |
| No hype or selling | No hype, "!", "glow", overclaiming or sales pitch |
| Ownership & boundaries | Owns mistakes, blames no one, nothing about private life |

Overall = average of the six, capped at the faithfulness score if that is 5 or below. 8+ = Ready to post, 6-7.9 = Needs light edits, below 6 = Rewrite. Up to 3 suggested fixes are included.

## Automatic deploys

The Vercel project is connected to this GitHub repo. Every push to `main` redeploys the bot to production automatically:

```bash
git add -A
git commit -m "describe the change"
git push
```

Environment variables live in Vercel, not in the repo. After changing one in the dashboard, redeploy from the Deployments tab (or push any commit).

## Changing the voice

Edit `voice-skill.txt` and push. The file is read on every request, so every draft uses the current version.
