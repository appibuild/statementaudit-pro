# StatementAudit Pro — Claude Code Takeover & Standalone MVP Kickoff

**Date:** 2026-06-23 (evening)
**Purpose:** Hand the project to Claude Code as the **single channel**, and ready it to build the standalone platform/server environment. Read this with `docs/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` (durable rules + board), `docs/GUARDRAILS.md` (G1–G7 + single-channel transition), and the latest handover `docs/STATEMENTAUDIT_HANDOVER_2026-06-23_1800.md`.

---

## 0. Pre-build gate (do this first)

Commit the pending docs so the repo is genuinely the single source of truth before anything new is built:
1. `docs/GUARDRAILS.md` — the G7 + single-channel update (its own commit).
2. `docs/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` — board→8, hosting, test-data line.
3. `docs/DECISION_RECORD_2026-06-23_1400_*` and `docs/DECISION_RECORD_2026-06-23_1800_*`.
4. `docs/STATEMENTAUDIT_HANDOVER_2026-06-23_1800.md`. **Discard the 1700 draft.**

Then `bash verify.sh` → ALL CHECKS PASSED at 1,568. Now the standalone work can begin.

---

## 1. How you operate now (single channel)

The two-channel split is retired (see GUARDRAILS "Single-channel transition"). You are the one channel; the repo is the source of truth. Carry these, every session:

- **Session start (G1):** read `PROJECT_INSTRUCTIONS.md` (durable rules + the eight-member board) and run `verify.sh`. If a long session compresses context, re-read before any strategic decision rather than trusting memory.
- **Board, for real.** Eight personas with defined remits. On a strategic decision, surface the relevant members' positions, **name genuine disagreement**, then give one opinionated recommendation. If a consultation produces no tension, you didn't really run it — that's the rubber-stamp failure mode to avoid.
- **Verify in the running app — "compiles" is not the bar.** This is the single most important habit to carry. Today's duplicate-viewer bug passed `verify.sh` while being unreachable in dead code; only clicking the live app caught it. Every correctness claim rests on a live run, with the check named (the G7 habit, now in commit messages / session notes).
- **Plan first, minimum change, confirm before any file save or delete.**
- **Continuity** = commit messages + dated decision records + a short dated session note if you stop mid-stream. No cross-channel handover documents needed.

**Note on the board:** they are *fictional advisory personas* defined in `PROJECT_INSTRUCTIONS.md`, not real people Stephen is contacting. Neither channel can message anyone; "consulting the board" is disciplined reasoning over their remits. If Stephen ever wants a real person to interact with an AI directly, that's a separate Claude Chat session on their side — not part of this build loop.

---

## 2. Standalone MVP — build brief

**Goal:** the smallest deployed thing a real user (Stephen self-playing the Practice Manager on QBO/Xero **sample companies**) can log into and run end-to-end. Get it live, then test, then learn.

**Hosting (decided — see `DECISION_RECORD_2026-06-23_1800`):** Render, **Starter (always-on), Frankfurt/EU region**. Frontend + proxy now; Postgres only if/when persistence is added (not in v1). ~£6–11/month.

**Architecture:**
- **Static React frontend** — port the existing UI from `src/statement-audit-pro.jsx`. Same screens, same flow.
- **Node/Express proxy** — holds `ANTHROPIC_API_KEY` **server-side only** (Render env var / secret); the key must never reach the client (this proxy is the whole reason for a backend). Forwards extraction requests to the Anthropic `/v1/messages` endpoint and returns the result. Render web services allow ~100-minute requests, so the long extraction call needs no streaming gymnastics (streaming optional, not required). Lock CORS to the frontend origin. Mirror the current friendly 429 / `exceeded_limit` handling.

**Minimum flow (v1):** upload PDF(s) → proxy → extract → review/edit → **approve (mandatory gate)** → CSV download → user imports to QBO/Xero manually. That's the whole product, deployed.

**Carry the non-negotiables verbatim** (port, don't reinvent): pinned model `claude-sonnet-4-20250514`; `max_tokens 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; the model-transcribes/code-does-arithmetic split (`recalc`, two-anchor opening, balance breaks); foreign-transaction rule; credit-marked-balance rule; UTF-8 BOM; DD/MM/YYYY; the mandatory approval gate hard-blocked on non-reconciliation; one general rule per account type. **Bring `verify.sh`'s fingerprint checks across** into a standalone equivalent (G6).

**Out of scope for v1 (defer — do not build now):** QBO/Xero OAuth, direct API push, database/persistence, multi-user accounts/auth, usage metering, semantic categorisation. Each waits for a real reason (most for post-beta).

**Live-testing requirement:** the MVP must be runnable and clickable by Stephen — a local dev run **and** a deployed Render URL — so correctness is proven by use, not by a green build.

---

## 3. Compliance (not now — a go-live gate)

Nothing compliance-related is required for sample-data beta (no real personal data, no customer). Before the **first real customer with real client data**, the go-live pack applies (DPA, sub-processor terms, US-transfer mechanism, JOIC registration, privacy policy, security baseline) — see `DECISION_RECORD_2026-06-23_1800`. Consult the Compliance & Data-Protection adviser and retain a real professional at that gate. Don't let it block or complicate the MVP.

---

## 4. First concrete steps for Code

1. Commit the pending docs (section 0); confirm `verify.sh` green.
2. **Plan-first:** propose the standalone repo structure (e.g. `/web` static frontend, `/server` Express proxy, or your recommended layout) and the deploy approach to Render Frankfurt — **and confirm with Stephen before building.** Consult Simon Willison (architecture/maintainability), Paul Jarvis (simplicity), Jason Fried (scope) on any real structural choice; name any disagreement.
3. Build the minimum flow; port the non-negotiables; stand up the proxy with the key server-side.
4. Deploy to Render (Starter, Frankfurt); give Stephen a URL to click.
5. Verify in the running app — the deployed thing, end-to-end, with a sample-company statement — before calling anything done.

---

*Operating reminder: plan first · board for real (surface disagreement) · verify in the running app, not the build · minimum change · confirm before any file save or delete · never persist real personal bank details · synthetic / sample-company / own / consenting test data only.*
