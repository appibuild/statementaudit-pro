# Decision Record — 3A BP-Direction Evidence + Data-Handling Confirmation

**Date:** 23 June 2026 (afternoon, ~14:00)
**Status:** Logged. No code or prompt change made. One deferred item remains benchmark-gated.
**For:** Companion to `DECISION_RECORD_2026-06-23_gate-hardblock.md`. Feeds the next handover. The data-handling section (Part B) confirms existing policy in `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` — it adds no new permission, only a written confirmation and a routine-testing rule.

---

## Plain summary

We tested whether the model still puts BP-coded money-IN rows in the wrong column (the "3A" problem). On a real HSBC current-account statement, then a fixture, then a batch of nine HSBC statements, it placed every BP row correctly and every statement reconciled to the penny. We are **not** changing the prompt: there is nothing failing to fix. 3A is downgraded from an open problem to a watch item. Separately, we confirmed how real personal statement data was handled during this testing and wrote down the rule for routine testing going forward.

---

## Part A — The 3A finding

### The reframe (this is the important bit)

The column-direction rule ("the COLUMN always wins; never infer direction from the payment-type code") has been live in the current-account prompt since commit `dd520e7` (22 June) and was verified on the ground-truth fixtures then. The BP flips seen on 23 June happened **with that rule already in place and passing**.

So the question was never "do we need a column rule" — we have one, and it works on the overwhelming majority of rows. The real question is narrower: *why does the existing rule sometimes lose to the model's prior on the specific BP code?* The leading hypothesis (unproven) is that the model carries a strong real-world prior that "BP = bill payment = money out," strong enough on that one code to override an instruction it otherwise obeys. The lever, if one were ever needed, would be that code's framing — not adding more rules. This is to be confirmed by a raw model response on an actual flipped row, then benchmarked — never edited straight into the build.

### What we tested and found (G7-tagged)

- **BP money-IN placed correctly, real 2026 HSBC statement — `VERIFIED LIVE`.** BOWEY AARON (£330) and FARRY R K (£16), both BP-coded and printed in the Paid-in column, came out as credits. The three BP money-OUT rows (Rosemary Farry £75, HSBC VISA £1,118.82, and the £68 row) came out as debits. Proof, not eyeballing: the five credits sum to exactly £7,231.79 — HSBC's own stated Payments In — which only holds if both BP-in rows are on the credit side. The statement reconciles to £742.30, matching the printed closing. 31 transactions across a page break, nothing dropped (Job 2 held).

- **BP money-IN placed correctly, 2024 fixture — `VERIFIED LIVE`.** FRANKHAM (£10, BP-coded paid-in) came through as a credit unprompted; the amber "Worth a check" is the model flagging an unusual row for human eyes, which is the gate doing its job.

- **3B flip-catcher + hard-block on a forced flip — `VERIFIED LIVE`.** Forcing FRANKHAM into the Debit column produced the £20 running-balance break, the amber "likely sign flip" banner, and the one-click "Change to credit?" suggestion on the correct row. Approval was hard-blocked (variance £40.00) until the suggestion was accepted; accepting reconciled to £1,474.89.

- **Breadth: a batch of nine HSBC current-account statements all reconciled — `VERIFIED LIVE` (as breadth) / `REASONED (unconfirmed)` (as stochastic stability).** Multiple periods, all the same charity-gift transaction style, every processed statement reaching reconciliation (one shown at 100/100, "Passes every check"). This is strong real-world corroboration that the BP-in handling holds. It is **not** proof of stochastic stability: it is many *different* statements passing, not the *same* input re-run to test the model's randomness, and it is all one bank and one account holder's style. So it raises confidence; it does not close the case.

### The decision

1. **No prompt change.** Nothing is failing live; changing the prompt now would be fixing an unreproducible problem.
2. **3A is downgraded to a watch item** — "resolved by the consistency change; monitor." If a BP-in flip is ever seen again, the next step is to capture the raw model response on that row first, then decide on the code-framing lever, then benchmark.
3. **The 3B catcher stays as the safety net** beneath this, with the hard-block enforcing it.

### Deferred (unchanged, benchmark-gated — not a flip cause)

The model is still asked to fill reconciliation arithmetic (`csvDebitTotal`, `csvCreditTotal`, `calculatedClosing`, `variance`, `reconciled`) that `recalc` discards and recomputes. This contradicts the "model transcribes, code does the arithmetic" non-negotiable and wastes tokens — both certain. Whether removing it changes flip behaviour is a hypothesis. It is a prompt change, so it goes through the parked benchmark (before/after), not straight into the build.

---

## Part B — Data handling during this testing (confirmation, not new permission)

### What was used

Real HSBC current-account statements belonging to Stephen and to Julia Morris, used with consent. This is squarely within the existing test-data policy: own / consenting clients' / synthetic / public-authority only — never Scribd or other repositories of strangers' financial documents.

### The honest processing facts (so the record is accurate, not reassuring)

- **The app sends each statement to the Anthropic API to read it.** This is inherent to extraction and identical to how the production product works. Real statement content is therefore processed by the API during testing.
- **The working chat now contains screenshots** showing the account holder name, sort code, account number, IBAN, and individual transactions.

For Stephen's and Julia's own statements with consent, this is an acceptable, deliberate choice — but it is not "zero data risk" in the absolute sense, and it should not be treated as such.

### What is NOT persisted

- **No real account details written to Claude's memory** — no account number, sort code, IBAN, holder name, or transaction. Confirmed this session.
- **Nothing real in git** — these statements are not committed to the repo.
- **This record contains no real account details** — only amounts needed to show the arithmetic proof, with no identifying account data.

### Durable rule for routine testing (going forward)

1. **Prefer synthetic seeded statements** for repeatable and regression testing. They give known ground truth and keep the validation lab from accumulating real personal data over time. (Already on the roadmap; this makes it the default.)
2. **Reserve real own / consenting statements for spot-checks** — like this session — not as the standing test corpus.
3. **Never** customer data without explicit consent; **never** strangers' documents from public repositories.
4. **Real personal bank details never enter memory or git.** Session-only working data, always.

This rule protects the same promise the product makes to its customers: privacy as a differentiator. Routine testing on synthetic data is the practice that keeps that promise honest internally, not only externally.

---

## Board of Advisers — light consult (not a gate change)

No approval-gate change was made this session, so full consensus was not required. Relevant voices:

- **Simon Willison (extraction reliability):** breadth across statements is good signal; it is not the same as repeating one input. Don't mark stochastic stability "verified" off different-statement passes. Capture a raw response if a flip recurs.
- **UK Practice Manager (the customer):** the hard-block held on a real forced flip — that is the behaviour that protects a bookkeeper from exporting a malformed file. Reassuring.
- **Paul Jarvis / privacy positioning:** the data-handling rule (synthetic-first) is the internal version of the external promise; a company-of-one can sustain it.

---

## Status / next

- **No build change.** Prompt untouched; `verify.sh` unaffected; build remains 1,651, commit `f928b22`.
- **3A:** watch item, evidence-first if it ever recurs.
- **Still queued (unchanged):** duplicate-viewer feature; Job 4 parser robustness (2023-03 parse error); findFlip debit-positive live test (needs per-row balance capture for credit/loan first).
- This record is a dated series document — keep it; do not overwrite.
