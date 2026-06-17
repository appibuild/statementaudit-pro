# StatementAudit Pro — Session Handover

**Date:** 2026-06-17 (evening, ~20:30)
**Changes since last handover:** Addressed the recurring stale-file trap at its root by creating a **canonical Git repository** around the live 1,524-line build, with a start-of-session anti-drift check (`verify.sh`) that passes on the current build. Corrected the rebuild brief, which had gone stale (it still listed Lloyds as the live open problem — it was resolved 06-16). No application code was changed this session. Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-17.md` (the earlier 06-17 handover remains valid for the CR fix detail).

---

## Purpose

Paste at the start of a new chat to restore context. This session was about **environment, not features** — fixing the thing that actually kept biting across sessions.

---

## The problem this session solved (and the one it did NOT)

A possible move to OpenAI models was on the table, framed as escaping a "loop of errors." On inspection of the handover trail, the loop is **not** failed fixes — each session has *closed* its edge case and verified it live (Confidence System 06-15; Lloyds opening + HSBC missing-row 06-16; CR/credit-balance 06-17). The real recurring problem, visible in every recent handover's opening warning, is the **stale-file trap**: the stored copy drifting from the live artifact, so sessions risked re-litigating closed work. A model swap does nothing for that, and would discard the working bank-quirk prompts. So this session fixed the environment instead.

**Decision recorded:** do not switch providers to escape errors. Any provider change is a *measured A/B against ground truth* (the Phase-2 benchmark already planned 06-16), decided on corrections-per-100, not frustration. Single-provider (Anthropic, pinned) until that benchmark earns a change.

---

## Built this session — the canonical repository

A ready-to-use Git repo (`statementaudit-pro/`) with:

- `src/statement-audit-pro.jsx` — the live **1,524-line** build, unchanged.
- `verify.sh` — **run this first, every session.** Checks the source file against the non-negotiables in `VERSION`: exact line count, pinned model `claude-sonnet-4-20250514`, `max_tokens: 32000`, robust JSON extractor present, **no** assistant prefill, resolved-work fingerprints present (`trueOpeningFromTop`, `openingAnchorsAgree`, `balanceBreaks`, `credit-marked balance`), foreign-transaction rule, UTF-8 BOM. Prints PASS/FAIL and exits non-zero on drift. **Confirmed passing on the current build.**
- `VERSION` — pinned facts (line count, model, token budget, last resolved item, open item).
- `README.md` — encodes the start-of-session rule and the working discipline.
- `.gitignore` — keeps `.env` secrets and any real customer statements/CSVs out of git.
- `docs/` — the **corrected** rebuild brief, project instructions, the 06-16 and 06-17 handovers, and the 06-12 decision record.
- One baseline commit, so history exists from here and stale snapshots can no longer win.

**How this ends the loop:** if a future session loads a stale copy (e.g. the 1,110-line one that bit on 06-16), `verify.sh` fails immediately and names the drift, instead of letting work proceed on the wrong base.

---

## Correction made to the rebuild brief (conflict found and resolved)

`docs/00_START_HERE_REBUILD_BRIEF.md` was stale. Its section 7 still told a rebuilder the Lloyds opening balance was the live open problem and "the single most important rule to get right." Per the 06-16 and 06-17 handovers that is **resolved**. Section 7 now: (a) lists the resolved correctness work to inherit, not rebuild — Lloyds two-anchor opening, HSBC integrity detection, CR/credit-balance rule; (b) names the **actual** open item, duplicate-detection tuning (item 4), with the three scenarios. The two stale pointers in sections 5 and 9 were fixed to match. Your own handovers were correct and were not changed — only my brief was.

*Standing request honoured going forward:* when a conflict is found, it will be named explicitly — what conflicts with what, which source is correct and why, and the smallest fix — and not silently reconciled.

---

## Current state

- **App:** 1,524-line build, all resolved work present and verified by `verify.sh`. No code change this session.
- **Open build item (next session):** duplicate-detection tuning (item 4). Scope decision still to make — all three scenarios in one pass, or Jason Fried's smaller first cut (soften same-statement repeats only). Decide in the new thread; do not assume.
- **Provider:** Anthropic, pinned. Benchmark before any change.

---

## Next steps

1. **Adopt the repo as the working copy.** From here, edit in the repo, commit each change, and run `./verify.sh` at the start of every session. This replaces "upload the live artifact and hope the stored copy isn't stale."
2. If you continue in the Claude.ai artifact too, treat the repo as the master: after a live change, paste it back into `src/` and commit, so the two never diverge again. (Standalone Claude Code build is the board-endorsed Phase 1 when a paying customer or a persistence need triggers it.)
3. **Then** pick up item 4 (duplicate detection), planning scope first.

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; `@`/`Visa Rate` foreign-transaction rule; UTF-8 BOM on export; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV; one general rule per account type, no per-bank prompt library; never persist real personal bank details; test data synthetic / own / public-authority transparency PDFs only.

---

*End of handover document. Paste this in full at the start of a new conversation to restore context.*
