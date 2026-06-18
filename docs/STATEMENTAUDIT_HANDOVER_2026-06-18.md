# StatementAudit Pro — Session Handover

**Date:** 2026-06-18
**Changes since last handover:** Corrected the badly-stale stored `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` to match the live build (committed `b9ba7f4`). Built and **live-verified** the first cut of **item 4 — duplicate-detection tuning** (scenario 2: same-statement repeats now amber + non-blocking; cross-statement overlap unchanged — red + blocks the gate). Committed `cd1567e`, build now **1,533 lines**, `verify.sh` passing all 11. Two reproducible extraction errors found during testing and logged to backlog (they are NOT item-4 bugs — the integrity check catches them correctly). Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-17_2030.md`.

---

## How to resume (read this first)

1. Paste this handover as the first message.
2. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,533**.
3. Load the live `src/statement-audit-pro.jsx` (1,533 lines).

---

## Built and live-verified this session — item 4, first cut (scenario 2)

**The change:** `findDupes` now returns `{ cross, same }` instead of one flat set. A `sid` comparison routes each match: same statement → `same`, different statement → `cross`. Downstream:
- The gate (`greenLit` via `isDupe`/`hasDupeStmt`) blocks **only** on `cross`. A legitimate same-day repeat within one statement no longer blocks the green tick.
- Same-statement repeats render **amber** (reusing the existing flagged/ambiguous styling) with an amber "Repeated charge on the same day" banner.
- Cross-statement overlaps are **unchanged**: red rows, red banner, gate blocked.
- Dashboard `dupeCount` counts `cross` only (cleaner alert number — decided this session).

**Seven edit sites:** `findDupes`, `dupeCount`, all-statements list badge, `isDupe`/new `isRepeat` split, sidebar badge, warning banner (+ amber sibling), row `tdBase` call. No fingerprinted non-negotiable touched.

**Live verification (the real scenarios, not a harness):**
- **Test (a) — PASS.** A real HSBC statement (20/10–19/11) with two identical `EB *STEVE WAND INT LONDON £76.55` rows on 10/11: both render amber, amber banner shows, and **"Everything adds up — this statement reconciles"** with the green state available. The same-statement repeat did not block the tick. Scenario 2 fixed.
- **Test (b)** — the cross-statement path is logically unchanged (the old detector's behaviour, now routed to `cross`); test (a) confirms the split routes correctly. A dedicated red/blocked screenshot was not captured this session — **optional tidy-up next session**, low risk.

**Decision locked:** smallest cut only (Jason Fried's lean). Scenarios 1 (whole-statement-loaded-twice collapse / upload-time catch) and 3-specific tuning were deliberately **not** built. Scenario 3 (cross-statement) already had the correct loud treatment and is untouched.

---

## Important: two reproducible extraction errors found — NOT item-4 bugs (backlog)

While testing, two real HSBC statements failed to reconcile. **Both are correct red flags** — the running-balance integrity check catching genuine extraction errors, exactly as designed. Neither is a dupe-detection problem. Re-run produced **no change** (errors are consistent, not random — a prompt/reading issue, not an API wobble).

**Separate proof from guess** applied below: the *what* is CERTAIN (proven by arithmetic against the printed balances); the *why* is HYPOTHESIS (~medium-high confidence, not yet confirmed by inspecting the model's raw output).

1. **Dec–Jan statement (Dr Julia Morris, 15/12/25–14/01/26) — £19.96 variance / £9.98 break 06–07 Jan.**
   - **CERTAIN:** the 07 Jan `VIS AMZNMktplace amazon.co.uk £4.99` was extracted as a **credit** but is a **debit** in the PDF. The sign flip moves £4.99 off Money-out and onto Money-in; the doubled effect = £9.98 at the break and £19.96 on the summary. The PDF itself reconciles perfectly (1,436.60 + 7,405.97 − 7,973.53 = 869.04).
   - **HYPOTHESIS:** credit/debit column misread on that row.
   - **Fix path:** one-row human correction in the grid (flip £4.99 to debit) — i.e. the review gate working as intended. No code change needed to *process* it.

2. **Jun–Jul statement (C S M & Dr J Morris, 20/06–19/07/25) — £2.54 variance / £1.27 break 24–25 Jun.**
   - **CERTAIN:** there are **two** legitimate identical `VIS SOJ PARKING JERSEY £1.27` charges on 25 Jun, split across the page-1/page-2 break. The model extracted one and **dropped its twin**. Money-out is exactly £1.27 short; the rest of the statement is exact.
   - **HYPOTHESIS:** page-break drop of the duplicate row.
   - **Notable:** this is the *same-day-identical-pair* case item 4 is about — but the risk here isn't a false dupe flag (the dupe softening handled that correctly), it's the model **dropping** one of the pair. The thing that caught it was the **integrity check**, not the dupe detector. The two safety nets worked in concert: dupe detector says "two identical → amber, probably real"; integrity check says "...but the balance is £1.27 short → red, one is missing." Exactly right.

**These belong in Phase-2 / prompt-tuning backlog, not a hot-fix.** Do not re-open the prompt reactively. They are precisely what the Phase-2 benchmark (corrections-per-100) is designed to measure. Two concrete cases now exist as test fixtures (synthetic-equivalent: Stephen's own statements, consent given).

---

## Documentation fix this session

`docs/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` was badly stale (267 lines removed, 135 added). It still said `max_tokens: 8000`, told future sessions to **reintroduce assistant prefill** (a direct non-negotiable violation), and listed Lloyds as open. Corrected to match the live build, scoped to *durable* truths only, with current status delegated to "the latest dated handover." Committed `b9ba7f4`. Board-endorsed scope (Fried/Hoy/Jarvis): instructions = always-true; handover = true-today.

**Still outstanding:** the Claude.ai **project Instructions field** (re-read at the start of every fresh chat) is a separate copy and may still be stale — paste the corrected version in there too, or drift returns through the front door. Also: the live `.jsx` internal header still reads "Last updated: 2026-06-17" — bump it to 2026-06-18 in the next commit (not a `verify.sh` failure; cosmetic).

---

## Current state

- **App:** 1,533-line build, `verify.sh` green (11/11). Item-4 scenario-2 live-verified.
- **Provider:** Anthropic, pinned `claude-sonnet-4-20250514`. Benchmark before any change.
- **Open build items:**
  - Item 4 remaining cuts (scenarios 1 + 3 tuning) — deferred, build only if a real need appears.
  - Two extraction errors above → Phase-2 prompt-tuning backlog.

---

## Roadmap (sequenced)

- **Phase 1 — extraction accuracy:** items 1 (Lloyds ✅), 2 (direction detect ✅ / prevent optional), 3 (credit-card edge cases ❌), 4 (dupe tuning — **scenario 2 ✅ this session**; scenarios 1+3 deferred).
- **Phase 2 — controlled benchmark (outside the artifact):** 20/20/20 OpenAI-vs-Anthropic, deciding metric = manual corrections per 100. The two errors logged today are ready-made fixtures.
- **Phase 3 — provider abstraction in standalone, only if Phase 2 earns it.**

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; `@`/`Visa Rate` foreign-transaction rule; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV; one general rule per account type, no per-bank prompt library; never persist real personal bank details; test data synthetic / own / consenting / public-authority transparency PDFs only.

---

## Next steps

1. Commit any header bump + this handover into `docs/`; `git add -A && git commit`.
2. Update the Claude.ai project Instructions field with the corrected instructions.
3. Optional: capture the cross-statement red/blocked screenshot to fully close test (b).
4. Then choose: Phase-1 item 3 (credit-card edge cases), or begin scaffolding the Phase-2 benchmark.

---

*Standing session rules: plan first · verify in the running app · separate proof from guess · human gate non-negotiable · flag assumptions one at a time · minimum change · plain language · confirm before any file save or delete · never persist real personal bank details.*
