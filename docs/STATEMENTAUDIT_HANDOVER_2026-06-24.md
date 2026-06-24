# StatementAudit Pro — Session Handover

**Date:** 2026-06-24
**Changes since last handover (2026-06-23 18:00):** Standalone MVP scaffolded and deployed to Render (Frankfurt, Starter). Model updated from retired `claude-sonnet-4-20250514` → `claude-sonnet-4-6`. Local dev via `npm run dev`. GitHub repo created (`appibuild/statementaudit-pro`). Job 4 (parser robustness) closed — 2023-03 statement now processes correctly on `claude-sonnet-4-6`. Job A VERIFIED LIVE (parse failure captured "Show raw response"). Roadmap: entering beta phase.

**Follows G7:** every claim carries `VERIFIED LIVE` or `REASONED (unconfirmed)`.

---

## How to resume

1. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,568**, latest commit on `main`.
2. Local dev: `npm run dev` from project root (starts Express on 3001 + Vite on 5173 via concurrently).
3. Deployed: https://statementaudit-pro.onrender.com (Render Starter, Frankfurt).
4. Next phase: **beta on QBO/Xero sample companies** — see Roadmap below.

---

## What landed this session

| Item | Status |
|---|---|
| Model updated to `claude-sonnet-4-6` | VERIFIED LIVE — 10 statements processed correctly |
| Standalone scaffold (`server/`, `client/`, root `package.json`) | VERIFIED LIVE — Render deployment, Frankfurt |
| GitHub repo created and pushed | VERIFIED LIVE — `appibuild/statementaudit-pro`, branch `main` |
| Job A — raw response capture on parse failure | VERIFIED LIVE — "Show raw response" appeared on error row for 2024-10-14 statement; errors-only by design |
| Job 4 — parser robustness | VERIFIED LIVE — 2023-03 statement now passes cleanly on `claude-sonnet-4-6`; failure was model-specific |
| `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` | Updated — model pin, auth note, Last updated date |

---

## Deployment state

- **Render:** https://statementaudit-pro.onrender.com — Starter, Frankfurt (EU Central), always-on
- **Build command:** `npm install --prefix server && npm install --include=dev --prefix client && npm run build --prefix client`
- **Start command:** `node server/index.js`
- **Env vars on Render:** `ANTHROPIC_API_KEY` (secret), `NODE_ENV=production`
- **GitHub:** `appibuild/statementaudit-pro`, branch `main`, auto-deploy on push
- **Local dev:** `npm run dev` from project root; `server/.env` holds API key (git-excluded)

---

## Roadmap status

| Step | Status |
|---|---|
| 1. Close the lab | ✅ Done |
| 2. Standalone MVP on Render | ✅ VERIFIED LIVE |
| 3. Beta on QBO/Xero sample companies | ← Next |
| 4. Build what beta proved | Not started |

**Beta objective:** Stephen self-plays the Practice Manager using QBO/Xero sample company data. Test the full pipeline end-to-end including the never-yet-verified CSV *import* into QBO/Xero. No real personal data. Measure before/after time. De-risks: does categorisation matter, right price, Ogilvy case study.

**Beta steps:**
1. Process a sample-company statement through https://statementaudit-pro.onrender.com
2. Review, edit if needed, approve
3. Export CSV (QBO or Xero format)
4. Import into QBO/Xero sample company
5. Record: did it import cleanly? Any mapping issues? Time taken vs manual?

---

## Open items (carry forward)

- **findFlip debit-positive live test** — `REASONED (unconfirmed)`: needs a credit card or loan statement with a printed running-balance column to verify the flip-catcher fires correctly.
- **Job A — errors-only confirmed** — by design; no change needed.
- **BUILD_PLAYBOOK.md** — one stale line mentioning "two channels"; minor, non-urgent.
- **npm vulnerabilities in client/** — 2 moderate/high in esbuild/vite dev dependencies; fix requires Vite 8 (breaking change); defer until Vite 8 is stable for our setup.
- **Compliance go-live gate** — required before first real customer (not for sample-data beta). DPA, sub-processor terms, JOIC, privacy policy, security baseline. Retain real Jersey+UK professional at this gate.

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-6`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; `@`/`Visa Rate` foreign-transaction rule; credit-marked-balance rule; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate (only path to CSV, hard-blocked on non-reconciliation); one general rule per account type, no per-bank prompt library; model transcribes, code does the arithmetic; API key server-side only, never in client; never persist real personal bank details.

---

## Current build state

- **Lines:** 1,568 (`src/statement-audit-pro.jsx` + `client/src/App.jsx` in sync)
- **verify.sh:** 11/11 green
- **Latest commits:** `cb04c83` (model fix), `35a5e4e` (standalone scaffold)
- **Branch:** `main` (renamed from `master` this session)
