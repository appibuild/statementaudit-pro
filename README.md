# StatementAudit Pro — Canonical Repository

This repository is the **single source of truth** for StatementAudit Pro. It exists to end the recurring "stale-file trap": for months the stored copy of the app kept drifting from the live artifact, so each session risked starting from an out-of-date snapshot and re-solving already-closed work. Git history + a start-of-session check make that impossible.

## Guardrails

The full anti-drift guardrails (with the diagnosis of why drift happened and the board's feedback) are in `docs/GUARDRAILS.md`. The short version: **G1** run `verify.sh` before working · **G2** commit before closing · **G3** trust the latest handover over any summary · **G4** diagnose with evidence before proposing big changes · **G5** name conflicts out loud · **G6** never let a change silently weaken the approval gate or the maths.

## The rule that ends the loop

**At the start of every session, before editing anything, run:**

```bash
./verify.sh
```

If it prints **ALL CHECKS PASSED**, this file is the canonical build and you may work. If it **FAILS**, the file has drifted — reconcile it against the live artifact (and update `VERSION`) *before* building anything. Never build on a file that fails the check.

## What's here

```
src/statement-audit-pro.jsx   ← the app (canonical 1,524-line build)
verify.sh                     ← start-of-session source-of-truth check
VERSION                       ← pinned facts: line count, model, token budget, open item
docs/                         ← brief, project instructions, latest handovers, decision record
.gitignore                    ← keeps secrets and real customer data out of git
```

## Working discipline (carried from the project standing rules)

- Plan first; confirm scope before building.
- Verify in the running app, not just a harness or a compile.
- Separate proof from guess: state a cause as fact only when proven by arithmetic or verified live; label hypotheses.
- The human approval gate is the only path to CSV. Never bypass it.
- Minimum change. One general rule per account type — no per-bank prompt library.
- Never commit real personal bank details. Test data is synthetic, own/consenting, or public-authority transparency PDFs.

## After each session

1. Commit your changes with a clear message: `git add -A && git commit -m "..."`.
2. If the line count changed, update `expected_lines:` in `VERSION` in the same commit.
3. Write a dated handover into `docs/` (never overwrite a previous one).

## Status (2026-06-17)

Resolved & live-verified: Lloyds opening (running-balance two-anchor), HSBC missing-row detection, CR/credit-balance opening. **Open build item: duplicate-detection tuning (item 4).** Provider is single (Anthropic, pinned); any move to a benchmark or another provider is a measured A/B against ground truth, not a frustration-driven swap — see `docs/00_START_HERE_REBUILD_BRIEF.md`.
