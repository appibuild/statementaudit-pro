# Claude Code Job — Parse-Failure Capture, then Cross-Statement Duplicate Viewer

**Paste this whole file as your first message to Claude Code.**
**Date:** 2026-06-23 (~14:30) · **Target build:** `src/statement-audit-pro.jsx`, 1,651 lines, commit `f928b22`.

---

## 0. Before you touch anything (session start)

1. Run `bash verify.sh`. Expect **ALL CHECKS PASSED** and line count **1651**. If it doesn't, stop and reconcile the file against the live build before doing anything else (G1).
2. You're current as of handover `STATEMENTAUDIT_HANDOVER_2026-06-23_1300.md` and decision record `DECISION_RECORD_2026-06-23_1400_3A-bp-direction-and-data-handling.md`. Nothing in those changes the build; they record that 3A and Job 4 are now watch items, not open fixes.
3. Channel rule: you do all file edits and commits. This is hands-on work — but stay inside the scope below.

## Standing rules for this job (not optional)

- **Minimum change.** Do only what's specified. No refactors, no tidy-ups, no "while I'm here."
- **Do not touch the protected non-negotiables** (`verify.sh` guards these by fingerprint — it must stay green): the JSON extractor (`indexOf('{')` / `lastIndexOf('}')` then a single `JSON.parse`), no assistant prefill, model pinned `claude-sonnet-4-20250514`, `max_tokens: 32000`, the foreign-transaction rule, the UTF-8 BOM, the running-balance/anchor work, and the mandatory approval gate.
- **Line numbers below are from the 1651 build and will shift after your first edit.** Locate each spot by the *code described*, not by blind line number.
- **Two separate commits** — Job A, then Job B. Update `expected_lines:` in `VERSION` in the same commit whenever the line count changes (G2).
- **Confirm before you commit** each job; don't commit silently.
- **Verify in the running app**, and tag each result honestly: `VERIFIED LIVE` (state what you did) or `REASONED (unconfirmed)` (G7). A compile or logic harness is provisional, not "verified live."

---

## JOB A (do this first) — Capture the raw model response when a parse fails

**Why.** When extraction fails, the app currently throws away the model's raw text. That's why the 22 June parse error could never be diagnosed — we had nothing to look at. This keeps the raw text on the statement *when (and only when) a parse fails*, so the next failure is diagnosable. **This is capture only. It is NOT a parser fix. Do not add a fallback parser.**

**Where.** The process function (the `useCallback` containing `fetch('https://api.anthropic.com/v1/messages'...)`). Today the model text (`rawText` / `raw`) is a local `const` inside the `try`; extraction is `indexOf('{')` → `lastIndexOf('}')` → one `JSON.parse`; the `catch` stores only `{ status:'error', error: err.message }` and the raw text is lost.

**Changes (all additive):**
1. Before the `try`, declare `let capturedRaw = '';`. Right after `rawText` is read, set `capturedRaw = rawText;` so it's in scope for the `catch`.
2. In the `catch`, include it: `updateS(id, { status:'error', error: err.message, rawResponse: capturedRaw || null });`.
3. Clear it so it never lingers: add `rawResponse: null` to (a) the `updateS` at processing start (`{ status:'processing', error:null }`), and (b) the success `updateS` (the one that sets `status:'review'`). Add `rawResponse: null` to the initial statement object (where `error:null` is set) for shape consistency.
4. UI, error rows only: where the queue card renders the error (`{s.error && <div>⚠ {s.error}</div>}`), add — only when `s.rawResponse` is set — a small "Show raw response" toggle that reveals a scrollable monospace box with `s.rawResponse` and a "Copy" button (`navigator.clipboard.writeText`). Keep it compact and confined to error rows.
5. Add a one-line comment noting `rawResponse` is session-only React state — never persisted (app is stateless, no storage), cleared on re-run and on success.

**Do NOT:**
- Change the extractor lines (`indexOf`/`lastIndexOf`/`JSON.parse`). No brace-depth fallback, no retry, no prefill.
- Change the success path, `recalc`, or the opening-anchor logic.

**Verify.** Induce one failure to confirm the raw is captured, shown, and copies (e.g. a throwaway tiny `max_tokens` locally, or a deliberately corrupt input). Revert the induce — **do not commit it**. Tag `VERIFIED LIVE` only if you actually induced a failure and saw the raw box populate and copy; otherwise `REASONED (unconfirmed)`.

**Then:** run `verify.sh` (must pass), update `VERSION` if line count changed, and **confirm with me before committing** Job A.

---

## JOB B (after Job A is committed) — Read-only cross-statement duplicate viewer

**Why.** Give the user one place to see every cross-statement double-count, instead of hunting across statements. **Surfaces data the app already computes. No new matching logic. No gate change.**

**The data you already have.** `findDupes` returns `{ cross, same }` — Sets of `"sid:tid"` keys. `cross` = genuine cross-statement double-counts (already drive the red banner, red row highlight, and the gate block). `same` = legitimate same-day repeats (don't block). **The viewer shows `cross` only.**

**Changes:**
1. One small addition to `findDupes`: in the existing match loop where it does `set.add(...)`, also collect matched pairs into a new returned field `crossPairs` — e.g. `[{ a:{sid,tid}, b:{sid,tid} }]` — built only when `a.sid !== b.sid`. (Needed because the flat `cross` Set doesn't record which two rows matched.) **Leave the `cross`/`same` Sets and the match condition exactly as they are.** You're adding an output field, not changing behaviour.
2. A read-only panel listing each cross pair: per pair show date, payee, amount, and the statement each side belongs to (bank + period, e.g. "HSBC · 15/02/2023–14/03/2023"). Add a "jump to statement" action that navigates to that statement in the review view (the row already self-highlights red via `isDupe`).
3. Empty state: "No cross-statement duplicates found."
4. Home: make the existing red "*N* possible duplicates across statements" banner open this viewer (the natural entry point). Modal or dedicated section — whichever fits the layout with least disruption.

**Do NOT:**
- Change the match condition, the `cross`/`same` Sets, `dupeCount`, the red banner text, row highlighting, or the gate block. Purely additive, read-only.
- Show same-statement repeats (`same`) here.
- Allow editing/deleting from this view — editing stays in the per-statement grid.

**Verify (live).** Create a genuine cross-statement duplicate — easiest is to upload the same statement twice as two entries. Confirm the viewer lists the pair with correct statement labels, jump-to-statement works, and the banner + gate behaviour are unchanged (glance at the gate after, since this touches `findDupes`). Tag `VERIFIED LIVE` with what you did.

**Then:** run `verify.sh` (must pass), update `VERSION`, and **confirm with me before committing** Job B.

---

## Close (after both committed)

- Confirm `verify.sh` is green and note the new line count and the two commit hashes.
- Write a dated handover `STATEMENTAUDIT_HANDOVER_2026-06-23_<HHMM>.md` with a one-line "Changes since last handover" at top, each job tagged `VERIFIED LIVE` / `REASONED (unconfirmed)`, and the queue state (3A and Job 4 are watch items; findFlip debit-positive live test still pending per-row balance capture for credit/loan).
- Confirm before any file save or delete. Never act on files silently.
