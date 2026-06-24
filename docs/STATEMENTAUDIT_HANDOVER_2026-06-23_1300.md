# StatementAudit Pro — Session Handover

**Date:** 2026-06-23 (afternoon)
**Changes since last handover:** The latent **findFlip / 3B sign bug** found and fixed (commit `f928b22`) — flip-detection now fires for the first time ever, live-verified. Also landed and verified this session: **Job 1 Balance-coverage visibility** and **Job 2 Transcription-completeness prompt rule** (at 1647), then **consistency-review fixes** (`d2b35e1`, 1651). A real **consistency audit** was run across prompt/code/architecture. Build now **1,651 lines**, `verify.sh` green. Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-23.md` (this morning's).

**This handover follows G7:** every claim carries a status tag — `VERIFIED LIVE` (with the live check named) or `REASONED (unconfirmed)`. Untagged = unconfirmed. Tags are per claim, not per job. (G7 added to `GUARDRAILS.md` this session, after the 3B post-mortem.)

---

## How to resume (read this first)

1. Paste this handover as the first message.
2. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,651**.
3. Load the live `src/statement-audit-pro.jsx` (1,651) if discussing code.
4. First decision next session: the **3A prompt decision** (below) — it's the only thing still actively causing extraction errors, and the audit already pointed the way.
5. Tiny tidy-up when the file is next touched: the header `Last updated:` line still says "consistency review" — bump it to reflect `f928b22`.

---

## What landed this session — all committed, build 1,651

In order:

**Job 1 — Balance-coverage visibility** (1647). `VERIFIED LIVE` — the neutral line ("No running balance read from this statement — totals checked, but individual rows can't be auto-verified") appeared correctly on the HSBC Bank plc no-balance statement during testing. When a statement has no per-row printed balance, the line shows on the reconciliation strip and the gate fix-list explains why no single row can be pinpointed. Stops the silent degradation that cost hours the previous session.

**Job 2 — Transcription-completeness prompt rule** (1647). `VERIFIED LIVE` — the SINTRA statement re-ran clean: both `…0054831001` and `…0054831002` extract with their fees and it reconciles; a fixture sweep across ~19 statements showed no doubling and joins intact. BASE_PROMPT now tells the model to transcribe every printed line, never merge two distinct transactions (a different reference number always means two), and never let a transaction be dropped or merged across a page break. The wrapped-line "join one transaction" rule was preserved.

**Consistency-review fixes** (`d2b35e1`, 1651). `REASONED (unconfirmed)` — both edits are in and compile, but their in-context behaviour isn't live-observed yet. The findFlip message now branches on account type (credit/loan no longer get "Paid-in/Paid-out column" language) — but that branch only renders when findFlip fires on a credit/loan statement, which can't happen until balance capture lands for those, so it's unverified live. The savings prompt's "Interest is always a credit / Withdrawals are always debits" was softened to "almost always… but the COLUMN always has final say," removing an absolute-vs-absolute clash — its effect on model behaviour is unverified.

**findFlip / 3B sign fix** (`f928b22`, 1651 — no line/VERSION change). One character plus the matching comment. This is the headline fix.

---

## The headline fix — 3B was never actually firing

**Proven:** the flip-detection mechanism (`findFlip`) had its sign condition inverted since `dc0bd00`. When a money-in transaction is wrongly recorded as a debit, its movement contributes −X instead of +X, so the computed expected balance is 2X too low and `gap = printed − expected` is **positive**. The old `gap < 0` test therefore never matched a real flip — the candidate filter searched the wrong column, `cands.length` was always 0, and `findFlip` silently returned null every time. Fixed to `creditPos ? gap > 0 : gap < 0` (the filter then correctly looks for the debit that needs flipping).

**Consequence to record honestly:** 3B has been "structurally present" since `dc0bd00` but had **never fired on a single real statement**. Earlier handovers implying 3B was complete / "matched the TFR case" were paper reasoning, never live-verified. This one-character bug is why.

**`VERIFIED LIVE` (credit-positive):** on the 15/04/2024 HSBC statement, forcing FRANKHAM (£10) back into the Debit column produced the £20 break, the amber "likely sign flip" banner, and the one-click "This looks like money IN… Change to credit?" panel on the right row. Accepting reconciles to £1,474.89, green. Detection → correct row → correct direction → one-click fix, all working.

---

## Status of each claim (G7 tags)

- **findFlip / 3B, credit-positive (current/savings):** `VERIFIED LIVE` — on the 15/04 statement, FRANKHAM (£10) forced back to Debit produced the £20 break, the amber "likely sign flip" banner, and the one-click "Change to credit?" panel on the right row; accepting reconciled to £1,474.89.
- **findFlip / 3B, debit-positive (credit card/loan):** `REASONED (unconfirmed)` — logic is symmetric and harness-confirmed, but those statements have no per-row balances captured yet, so it can't be live-tested.
- **Model reading BP-coded paid-in credits correctly on its own:** `REASONED (unconfirmed)` — seen on **one** clean run after the consistency prompt change (FRANKHAM/SHOBBROOKWA came out as credits unprompted). One run is not stability. Watch item for the 3A decision, NOT closed.

---

## Diagnoses logged this session

- **SINTRA page-break merge:** `VERIFIED LIVE` (cause confirmed) — the model merged two distinct transactions (same merchant/amount, different reference) across a page break, dropping one. Proven by arithmetic (£4.46 = £4.35 + £0.11) and the running-balance break, and the clean re-run producing both lines confirmed the cause was model merging (the parser has no de-dup logic). Fixed by Job 2.
- **BP direction flip:** *what* is `VERIFIED LIVE` / *why* is `REASONED (unconfirmed)`. The two BP-coded paid-in gifts (FRANKHAM £10, SHOBBROOKWA £360) being money-in is proven by the statement's own running balance (the *what*). That the model decided direction from the BP code over the column (the *why*) is reasoned from the pattern — every CR-coded paid-in came through right, both BP-coded paid-in flipped — not yet confirmed against raw output. This is the 3A issue, open at source; findFlip now catches it after the fact.
- **Account-type switch:** `VERIFIED LIVE` — HSBC Bank plc came in as a current account with a £795.98 variance, the app spotted it reconciles exactly as a credit card, offered the one-click switch, and it went to 100/100 reconciled (observed in the running app).

---

## Consistency audit — findings (run this session)

Fixed (in `d2b35e1`): flip-message column language for credit/loan; savings absolute/absolute direction clash.

**Documented, deferred to the 3A decision (NOT yet fixed):**
1. **Mixed direction message.** The prompt teaches code→direction in several places (savings: "withdrawals are always debits"; credit/loan: "PUR = debit, PMT = credit") while insisting elsewhere the column always wins. A credible contributor to the BP flips. The fix is likely to *remove* the code-direction language, not add more rules.
2. **Model is asked to do reconciliation arithmetic** (`csvDebitTotal`, `calculatedClosing`, `variance`, `reconciled`) which `recalc` then discards and recomputes. Contradicts the core "model transcribes, code does the maths" non-negotiable. Proven wasteful; whether it actively nudges the model to fudge data to "make it reconcile" is a hypothesis — settle it by stripping the arithmetic-asking and benchmarking before/after.

Both are **prompt changes → benchmark-gated**, not straight into the build.

---

## Queued next (in order)

1. **3A prompt decision** — stop the model putting BP-coded credits in the wrong column at source. The audit points to: remove the code→direction language and the model-does-arithmetic asking, rather than pile on more "column wins" text. Evidence-first: a few more runs (and ideally the parked benchmark) to see how much the consistency change already fixed it. Prompt change → benchmark, not direct.
2. **Duplicate-viewer feature** (parked, board-discussed). A consolidated, read-only view of **cross-statement** duplicates only (not same-day repeats), each labelled by statement, with jump-to-statement. Surfaces the existing `dupes.cross` data; no new matching logic, no gate change. Build on the now-clean base.
3. **Job 4 — parser robustness** (still open from 06-22): the 2023-03 JSON parse error; add a brace-depth fallback that extracts the first complete top-level object. Never weaken to plain `JSON.parse`; no prefill.
4. **findFlip debit-positive live test** — becomes possible once per-row balance capture works for credit/loan statements.

---

## Board of Advisers — seven

Amy Hoy · Jason Fried · UK Practice Manager · Paul Jarvis · David Ogilvy · Angus Cheng · Simon Willison (AI/extraction, enrolled 23-06). Gate-level changes need full consensus. No gate change this session (the hard-block was already in from `7eec871`).

---

## Current state

- **App:** 1,651-line build, `verify.sh` green, latest commit `f928b22`.
- **Commits this session:** Job 1 + Job 2 (→1647), `d2b35e1` consistency review (→1651), `f928b22` findFlip sign fix (1651). Hashes for Jobs 1&2 weren't captured in chat; `git log` will show them.
- **Provider:** Anthropic, pinned `claude-sonnet-4-20250514`. Benchmark before any change.
- **Strategic, still owed:** standalone move (gated on finishing in-artifact work); commercial/pricing review (before pricing or new-app scoping).

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; `@`/`Visa Rate` foreign-transaction rule; credit-marked-balance rule; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV (hard-blocked on non-reconciliation); one general rule per account type, no per-bank prompt library; model transcribes, code does the arithmetic; never persist real personal bank details; synthetic / own / consenting / public-authority test data only.

---

## Next steps

1. (Optional artifact) Save a short consistency-audit decision record to `docs/` capturing the two deferred findings, so the 3A decision opens with them attached.
2. Open the 3A decision next session — evidence-first, benchmark-gated.
3. Then duplicate-viewer, then Job 4.
4. Close each session with a dated handover + commit.

---

*Standing rules: plain language · verify in the running app · separate proof from guess · evidence before fixes · human gate non-negotiable · make silent failure loud · minimum change · confirm before any file save or delete · never persist real personal bank details. And the lesson re-learned this session: don't mark a thing "verified" off an unrelated success — ask what was actually done first.*
