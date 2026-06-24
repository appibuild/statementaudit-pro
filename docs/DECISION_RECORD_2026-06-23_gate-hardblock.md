# Decision Record — Export Hard-Block for Non-Reconciling Statements

**Date:** 23 June 2026
**Status:** Approved — full board consensus (incl. new technical member). Ready to build in Claude Code.
**For:** Append to `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` (Non-Negotiable Quality Standards) once built. Companion to `DECISION_RECORD_2026-06-22_standalone-trigger.md`.

---

## Plain summary

The app must not let a statement be approved or exported until its numbers balance. When it does not balance, the app shows the user what to fix instead of an Approve button. There is no "export anyway" escape — not yet, and not until a real customer hits a genuinely unfixable case.

## The decision

When a statement does **not** reconcile (variance ≥ £0.02):

1. **Approval is blocked.** The Approve & Export button is disabled, and the underlying `approve()` handler refuses.
2. **A guided fix-list replaces the button** — it tells the user what is wrong and, where possible, offers a one-click fix.
3. **No dead-end.** The user can still edit rows and still Reject.
4. **No override path** is built. Evidence before fixes: we have not seen a single genuinely unfixable variance, so we do not build an escape-hatch for a case that may not exist. If a real customer presents one, we add a narrow, deliberate, logged override then.

## Why this is needed (the evidence)

This was proven live on 23 June 2026, not hypothesised. The `approve()` handler (line 610) is currently **unconditional** — it sets status to "approved" with no reconciliation check. The green ⚡ fast-track button requires a reconciled statement, but the ordinary header **Approve & Export** calls the same unguarded handler.

We deliberately broke one row of a balancing statement (moved a £2,500 transaction into the wrong column) and approved it. A **£5,000-variance, 60/100-confidence statement exported to a downloadable CSV** — and that CSV contained a transaction with no amount in either money column (it would import to QuickBooks as a £0 line). The app warned loudly (red "doesn't match" banner, amber "Variance" tag) but did not stop the export.

So the current gate guarantees **a click, not reconciliation.** The product's headline promise — a finished, reconciled file before QuickBooks is opened — cannot stand if a malformed file can leave behind only an amber tag. This is the rubber-stamp failure mode the 06-22 standalone record warned about, made concrete.

## Board of Advisers — on record (23 June 2026)

**New member enrolled this session: Simon Willison** — deep practical AI/LLM engineering; "ship pragmatic, verify everything"; local-first/privacy instinct. Remit: extraction architecture, prompt design, AI reliability, solo-dev maintainability.

| Adviser | Position | Reasoning |
|---|---|---|
| UK Practice Manager | Hard-block + guidance | An amber tag won't stop me at 5pm; a block will. Just never leave me stuck — show me what to fix. |
| Amy Hoy | Hard-block | A variance here is almost always a fixable extraction error, not a fact to accept. "Approve with variance" mostly means "approve a mistake." |
| Jason Fried | Hard-block (simplest) | A clean file or no file. No override dialog to build — the simplest honest gate. |
| David Ogilvy | Hard-block | "Every exported file reconciles — no asterisk" is a far stronger claim than a warning the user can click past. |
| Paul Jarvis | Hard-block | The mandatory audit gate IS the positioning. A bypassable gate weakens it. |
| Angus Cheng | Hard-block | Can't market a guarantee that's one click from being broken. |
| Simon Willison | Hard-block (low-risk) | Keys off the `reconciled` flag the app already computes — no AI involved, nothing in extraction can regress. Conditions: never a dead-end; no override yet. |

**Consensus: unanimous.** This supersedes the 06-22 "friction with logged override" direction, after Stephen's challenge — "why accept the variance if it's wrong?" — exposed that a variance in this product is almost always a fixable error, not something to wave through.

## Build spec — Job: Gate Hard-Block (for Claude Code)

Touches the approval gate (the most protected area). It only ever **restricts** approval — it never removes the human click and never adds a bypass — so it strengthens the gate, consistent with the non-negotiable.

1. **Block approval when not reconciled.** Guard `approve()` (line 610) to refuse when `!rec.reconciled` (variance ≥ £0.02). Disable the header "Approve & Export" button in that state. Guard **both** handler and button.
2. **Guided fix-list in place of the button** when not reconciled. State the variance, then surface what the app already knows: `balanceBreaks` (name the date span), `flipSuggestions` (the 3B one-click Accept, where present), the opening-balance helper if `openingLikelyOff`, the account-type switch if `accountTypeLikelyWrong`. Fallback line where nothing pinpoints it: "check the flagged rows, and that money in/out is in the right column."
3. **Never a dead-end.** Editing and Reject stay available. No "export anyway" override.
4. **Do not touch:** the human-click requirement, the visible reconciliation strip, or any `verify.sh` fingerprint (model pin, max_tokens, JSON extractor, no prefill, foreign-transaction rule, credit-marked-balance rule, UTF-8 BOM).

**Verify live (not just compiled):**
- A balancing statement → approves and exports exactly as now.
- Break a row → approval blocked, fix-list shows; correct it → unblocks and approves.
- `verify.sh` green; bump `VERSION` and the file's `Last updated:`; commit on its own.

## Related finding (logged this session) — 3B fires only on balance-carrying statements

Proven live + in code: the 3B flag-and-correct mechanism (`findFlip`) lives entirely inside `if (idxFirstBal !== -1)` (line 193) — it requires at least one transaction carrying a printed running balance. The test HSBC statements reconcile via summary totals but were extracted **without** the per-row balance, so 3B is structurally inert on them (no break banner, no flip pill — confirmed).

Confirmed from a PDF (23 June): HSBC **does print a Balance column**, but only an **end-of-day** figure. We are simply not capturing it. So the fix is **capture, not compute** — a self-computed balance cannot catch the error it is checking (it is not independent of the transactions); the bank's printed balance is the independent second opinion that makes the row-level check work.

**Conflict named (G5):** the 06-22 handover stated 3B's 2×X signature "matched" the TFR case. Live, 3B cannot fire on that statement (no captured balance). That match was reasoned on paper, never verified live.

**Job 3 status, honestly:** 3A (prevention) verified live and solid. 3B verified *as designed* (inert without balances), never seen firing. Coverage is conditional until balance capture lands.

## Queued next (in order)

1. **Job: Gate Hard-Block** — this record. Works on every statement. Highest protection. Build first.
2. **Job: Capture HSBC end-of-day Balance column** — a *general* "transcribe the Balance column" prompt rule (not per-bank, not computed), leaving the foreign-transaction and credit-marked-balance rules untouched. Makes 3B and the opening-balance checks work on these statements.
3. **Job 4 — parser robustness** (the JSON parse error; brace-depth fallback) — still open from 06-22.

---

*Subject to Guardrail G3: if a future handover or the live code supersedes this, correct it in the same session and note it.*
