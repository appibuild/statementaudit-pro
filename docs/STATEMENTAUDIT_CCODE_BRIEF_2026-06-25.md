# StatementAudit Pro — Claude Code Build Brief 2026-06-25

**Changes since last handover:** Strategy chat session — no code changed. Decided the next two build jobs: (1) roll-back / undo, (2) a live expected-vs-printed balance-check column in the review screen. Rejected an alternative idea (move the audit/editing into an exported spreadsheet with Copilot reasoning) on architecture and compliance grounds, backed by a simulated bookkeeper/accountant panel. Excel export of the approved file + a human-edit audit log noted as deferred, not built.

**Channel:** Written in the strategy chat channel. All file edits, commits, `verify.sh` and deployment remain Claude Code's. This is the bridge — load it, run `verify.sh`, do **JOB 0** below, then work.

**Source-of-truth note:** The code facts in this brief were read from the *project copy* of `statement-audit-pro.jsx` on 2026-06-25 (grep, not run live). The live working copy wins (G3). JOB 0 re-confirms them before any build.

**Labelling:** **READ FROM SOURCE** (with the line/grep that found it) · **REASONED** (design judgement, unconfirmed) · **DECISION NEEDED** (Stephen's call before coding).

---

## JOB 0 — Conflict check FIRST (do not skip, do not build through it)

Before building anything, confirm this brief still matches the live build. If anything below is false against the live working copy, **stop and report the conflict** — name what conflicts with what, which is correct, and the smallest fix (G5). Do not silently reconcile.

1. `bash verify.sh` must print **ALL CHECKS PASSED**. If not, reconcile against the live build before any work (G1).
2. Reconcile against the **most recent dated handover in `docs/`** — the handover wins on status over this brief, and over the project instructions. (Latest seen in the project copy: `STATEMENTAUDIT_HANDOVER_2026-06-24.md`. Stephen may have a newer one in the live repo — use the newest.)
3. Confirm these assumptions this brief depends on (all **READ FROM SOURCE** 2026-06-25 — re-confirm live):
   - The model's original read is preserved untouched in `transactions`; human edits are written to `editedTransactions` (null until first edit). *(state shape; line ~499 sets `editedTransactions:null` on load)*
   - Every edit handler re-runs `recalc` + `calcConfidence` immediately — edit balance (~line 543–552), account-type switch (~569–572), edit transaction (~583–586), delete row (~599–601), flip (~605–614).
   - The deterministic balance-walk that produces `balanceBreaks` lives inside `recalc` (~line 124).
   - The two-anchor opening fix is applied on load and sets `openingAdjusted` / `printedOpening` (~line 486–499).
   - There is currently **no** undo / revert / roll-back anywhere (grep for `undo|revert|rollback|original` returns only a prompt line, ~line 61).
   - The gate hard-blocks any non-reconciling statement (~line 619).
4. Report back: green light, or the list of conflicts. Only then proceed to JOB 1.

---

## ⚠️ The one thing not to get wrong (applies to JOB 1)

**"Reset to original" reverts human edits — NOT the deterministic auto-fixes applied on load.**

The two-anchor opening adjustment (the Lloyds fix: `openingAdjusted` / `trueOpeningFromTop` / `derivedOpening`) is a *correct automatic correction*, not a user edit. Revert must return the statement to its **as-loaded, reconciled** state — never to the raw pre-fix printed-opening state.

Build the revert baseline as **"model's original read + deterministic auto-fixes"**, and revert only the human-edit layer above that. Undoing the opening fix would silently re-introduce the exact error the architecture closed (a silent failure — the project's named worst case).

---

## JOB 1 — Roll-back / undo (smaller, self-contained — do this first)

**Scope:** two controls — "reset whole statement to original extraction" and "reset this row to original." Both are reads of data that already exists; no new arithmetic.

**Considerations:**
- **Statement reset** = discard `editedTransactions` (set to null), then re-run `recalc` + `calcConfidence` exactly as existing handlers do. This also cleanly restores deleted rows.
- **Per-row reset** matches by transaction `id`. Reverting a *deleted* row means re-inserting it in original position — preserve original transaction order. This is the only fiddly case. **REASONED:** if it adds risk, ship statement-level reset first and treat per-row revert of a *deleted* row as a fast-follow.
- If `editedTransactions` is null (no edits yet), revert is a no-op — disable/hide the control.
- **DECISION NEEDED (Stephen):** statement reset should also revert edited opening/closing balances and a manual account-type switch (these are human edits) — but **must not** revert the deterministic two-anchor opening fix (see warning above). Confirm this scope before coding.
- **Do NOT** build a step-back undo *stack* (undo last N). That needs a new history structure in state — bigger job, not now. Note as a later option only if users ask.
- **Do not touch the gate.** Revert only changes working data; the gate still hard-blocks non-reconciling statements.

---

## JOB 2 — Live expected-vs-printed balance-check column (do second)

**Scope:** per row, show the deterministically-computed *expected* running balance next to the *printed* balance the model transcribed, with an agree/break indicator, recomputing live on every edit. This gives the "watch it reconcile as you type" feedback that makes a spreadsheet feel safe — inside the gate, with the PDF link and integrity check intact.

**Considerations:**
- **Single source of truth — reuse the existing balance-walk inside `recalc`** (the one that already produces `balanceBreaks`). Do **not** write a second, parallel arithmetic path, or the two will drift.
- **REASONED (confirm before coding):** cleanest data approach is to have `recalc` expose the per-row expected balances (e.g. keyed by tx `id`) as part of its output, and have the row renderer read that. Do **not** persist an `expectedBalance` field on each Transaction — it would need re-syncing on every edit and could drift.
- **Respect polarity** — the walk direction differs for credit-positive (current/savings) vs debit-positive (credit card/loan). Reuse recalc's existing handling; do not re-derive it.
- Rows with no printed balance (`balance: null`): show expected only, "—" for printed, and **do not** flag a mismatch where there is nothing to compare.
- **Foreign-transaction rows** (VIS / "@" / "Visa Rate") must stay in the walk — never excluded (non-negotiable foreign-transaction rule).
- Hook into the same handlers that already call `recalc` — updates on every edit/delete/flip/balance change with no separate trigger.
- **DECISION NEEDED (Stephen / layout):** the row is already dense. Where the indicator sits, and whether to show the expected figure always or only on divergence, is a layout call — flag it, don't guess.
- Styling: light theme, inline styles, JetBrains Mono for figures, `C` colour constants. No Tailwind / CSS classes without flagging a deliberate departure.

---

## Deferred — note, do NOT build now

- **Excel export of the approved file** (for working papers). Post-gate, no re-import, breaks nothing. Small later add.
- **Human-edit audit log** (model's original read vs final approved). Runs off the **same** `transactions` vs `editedTransactions` comparison as roll-back — so whoever builds JOB 1 should keep that comparison clean and accessible, which makes the log cheap later. Don't build it now (scope discipline); just don't foreclose it.

---

## Session / job rules that apply to this work

- `bash verify.sh` first; ALL CHECKS PASSED before any work (G1).
- Plan and confirm scope before building; **one job at a time** — JOB 1, then JOB 2.
- **Minimum change** — don't refactor `recalc`, don't go near the gate. The balance-check column is display-only; confirm it does not alter the gate's hard-block.
- **Verify in the running app**, not just an esbuild compile. Specifically:
  - JOB 1: load a statement, edit it, then revert — confirm it restores the **as-loaded reconciled** state and does **NOT** undo the two-anchor opening fix.
  - JOB 2: load a statement, make an edit, confirm the balance-check column updates live and matches what `recalc` reports.
- **Consider a new `verify.sh` fingerprint** (G6) to lock the two things this work introduces: (a) the balance-check column reuses `recalc` (no parallel arithmetic), and (b) revert preserves the deterministic opening auto-fix. Adding a guardrail when touching/extending the arithmetic path is in keeping with G6 — flag the wording to Stephen.
- Update the **state-shape** section of the project instructions if any new field lands.
- End with a dated handover (`STATEMENTAUDIT_HANDOVER_2026-06-25.md`), a one-line "Changes since last handover", and a commit.

---

## Decisions needed from Stephen before coding (collect up front)

1. **JOB 1 scope:** does statement reset also revert edited balances + manual account-type switch (recommended yes), while never reverting the deterministic opening fix (required)?
2. **JOB 2 data approach:** expose per-row expected balances from `recalc` output (recommended) vs any alternative?
3. **JOB 2 layout:** where the indicator/figure sits in an already-dense row; show expected always or only on divergence?
