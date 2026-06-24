# StatementAudit Pro — Session Handover

**Date:** 2026-06-23
**Changes since last handover:** Gate Hard-Block built and live-verified (commit `7eec871`, build now **1,636 lines**). Job 3 properly assessed live for the first time: **3A (direction prevention) verified solid; 3B (row-level flag-correct) found to fire ONLY on statements with captured per-row balances — none of the test statements had them, so 3B has never been seen firing.** Root finding: balance-based checks were silently switched off (the app asks for and stores the balance, but it came back blank on these statements, and the app degraded silently). New board member **Simon Willison** (AI/extraction) enrolled. New artifacts: `DECISION_RECORD_2026-06-23_gate-hardblock.md`, `BUILD_PLAYBOOK.md`. Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-22.md`.

---

## How to resume (read this first)

1. Paste this handover as the first message.
2. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,636**.
3. Load the live `src/statement-audit-pro.jsx` (1,636 lines).
4. First build action: **Job: Balance-coverage visibility** (below) — the small fix that stops the silent degradation that cost us hours. Then **Job 4** (parser robustness).
5. Note the start-of-session lesson: this morning began messy because Job 3 had landed last session with no handover. Don't repeat — always close with a handover + commit.

---

## What landed this session

### Gate Hard-Block — built & live-verified (commit `7eec871`, VERSION 1636)
Approve/export of a non-reconciling statement is now blocked. Proven need: on 23-06 a deliberately-broken row exported a £5,000-variance CSV through the unguarded `approve()` (the file had a £0 transaction). Three changes, all strengthening the gate:
- `approve()` guards on `rec.reconciled`; returns silently if not reconciled.
- Header button shows **⛔ Fix required** (red, inert) when not reconciled, instead of Approve & Export.
- A red **guided fix-list** panel states the variance and surfaces whatever the app knows (flip suggestion, balance-break span, account-type switch, opening helper) with a plain fallback; editing and Reject stay available; **no override path**.
Live-tested: break a row → blocked + fix-list; correct → unlocks and exports as before. No `verify.sh` fingerprint touched. Decision + board on record in `DECISION_RECORD_2026-06-23_gate-hardblock.md`.

---

## THE BIG FINDING — balance checks were silently off

**Certain (code + live):** 3B's flag-and-correct (`findFlip`) and the missing-row integrity check both live inside `if (idxFirstBal !== -1)` (line 193) — they need at least one transaction carrying a printed running balance. A clean single-row flip on the 15/06/2025 statement produced **no break banner and no flip pill** → no balances were available to the checks on that statement.

**Certain:** the prompt **does** ask for the balance column (line 67, detailed) and the parser **does** store it (line 466). HSBC prints an **end-of-day** balance (confirmed from a PDF, 23-06). So the architecture is wired correctly; the figures simply didn't come through on these statements.

**Hypothesis (high) — confirm before fixing:** the model returned the balances as blank (null), likely around wrapped/multi-line day entries. Confirm by capturing one raw model response for the 15/06/2025 statement and looking — do **not** assume.

**The real barrier:** not a missing feature, but **silent degradation** — the row-level safety net was off and nothing said so. We diagnosed by hand what the app was built to do automatically. Meta-lesson (now in the playbook): verify the assumption against real data, and make silent failure loud.

**Conflict named (G5):** the 06-22 handover said 3B's 2×X signature "matched" the TFR case. Live, 3B cannot fire on that statement (no balance available). That match was reasoned on paper, never verified live.

**Job 3 status, honest:** 3A verified live and solid. 3B verified *as designed* (inert without balances), **never seen firing**. Coverage is conditional until balance capture is confirmed working.

---

## Balance idea (Stephen) — capture, not compute

Stephen proposed adding a running-balance column where statements don't show one. Resolution: a **computed** balance can't catch the error it checks (not independent of the transactions), so it must never feed the auto-checks. Capture the **bank's printed** balance (the independent anchor) instead. A computed column is fine only as a clearly-labelled human aid (strongest in the standalone side-by-side view).

---

## Queued next (in order)

1. **Job: Balance-coverage visibility** (UI + deterministic, no prompt change, no fingerprint touched):
   - When `integrityChecked` is false (no per-row balances), show a neutral line on the statement: *"No running balance read from this statement — totals checked, but individual rows can't be auto-verified."*
   - In the gate fix-list, when a statement won't balance **and** has no captured balances, add that line so the user knows why no row is pinpointed.
   - `verify.sh` green; bump VERSION + Last updated; commit on its own.
2. **Job 2b — investigate capture:** grab one raw model response for the 15/06/2025 statement; confirm whether balances came back blank. Evidence before any prompt change.
3. **Job 4 — parser robustness** (the 2023-03 JSON parse error; keep current slice as first attempt, add a brace-depth fallback that extracts the first complete top-level object; never weaken to plain `JSON.parse`; no prefill). Still open from 06-22.
4. **3B coverage revisit** — only meaningful once balance capture is confirmed; then re-test 3B firing on a balance-carrying statement.

---

## Board of Advisers — now seven

Amy Hoy (problem/customer/pricing) · Jason Fried (scope) · UK Practice Manager (customer voice) · Paul Jarvis (positioning) · David Ogilvy (copy/conversion) · Angus Cheng (content/growth) · **Simon Willison (AI/LLM engineering, extraction reliability, solo-dev maintainability — enrolled 23-06)**. Gate-level changes need full consensus.

---

## Current state

- **App:** 1,636-line build; Gate Hard-Block live-verified; `verify.sh` green.
- **Provider:** Anthropic, pinned `claude-sonnet-4-20250514`. Benchmark before any change.
- **Open build items:** balance-coverage visibility (next), Job 2b investigate, Job 4 parser, 3B coverage revisit.
- **Strategic:** standalone move still gated on finishing in-artifact work (06-22 decision record). Commercial/pricing review still owed before pricing/new-app scoping.

---

## New / updated artifacts this session

- `DECISION_RECORD_2026-06-23_gate-hardblock.md` — gate decision, full board, build spec, balance finding. **Save to `docs/`.**
- `BUILD_PLAYBOOK.md` — portable, generic build lessons; canonical (replace, don't append); update at session-end. **Save to `docs/`** (or a shared location for future apps).
- This handover. **Save to `docs/`.**

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor (Job 4 extends, never weakens), no prefill; `@`/`Visa Rate` foreign-transaction rule; credit-marked-balance rule; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV (now also hard-blocked on non-reconciliation — strengthens, never bypasses, the gate); one general rule per account type, no per-bank prompt library; never persist real personal bank details; synthetic / own / consenting / public-authority test data only.

---

## Next steps

1. Save the three artifacts above into `docs/` (dated files kept; `BUILD_PLAYBOOK.md` replaces any prior).
2. Hand Code the **Balance-coverage visibility** job (read the file on disk, don't paste) — `verify.sh`, VERSION bump, commit.
3. Job 2b investigate raw output; then Job 4 parser.
4. Close that session with a fresh dated handover + commit.

---

*Standing session rules: plain language · verify in the running app · separate proof from guess · evidence before fixes · human gate non-negotiable · make silent failure loud · minimum change · confirm before any file save or delete · never persist real personal bank details.*
