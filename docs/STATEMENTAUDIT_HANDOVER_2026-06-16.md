# StatementAudit Pro — Session Handover

**Date:** 2026-06-16
**Changes since last handover:** Built and **live-verified** the running-balance pass — the app now captures the printed running-balance column and uses it to (a) auto-correct the true opening balance when two independent derivations agree (the Lloyds quirk — no click), and (b) flag any dropped or mis-entered transaction via a per-row integrity check (the HSBC missing-£500 class). Earlier in the session, also shipped the Lloyds opening-balance **presentation reframe** (calm amber state instead of red alarm). All test statements now reconcile in live testing. Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-15_1730.md`.

---

## Headline

The **Phase 1 accuracy core is closed** (live-verified). The two errors that drove this session — the Lloyds opening balance and the HSBC missing £500 — are both resolved by **one mechanism: the running-balance column**. Phase 1 is *not* fully complete (items 3 and 4 below remain). Next major move is **Phase 2**, the controlled 20/20/20 OpenAI-vs-Anthropic benchmark.

---

## How to resume (read this first)

1. Paste this handover as your first message.
2. Upload the live `statement-audit-pro.jsx` (~**1,521 lines**). **Do not trust the project's stored copy** — it drifted badly this session (found at 1,110 lines, missing the entire Confidence System and still on `max_tokens: 8000`).
3. **Verify at session start** in the live file: line count ~1,521; model pinned `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` parser (no prefill); running-balance code present (grep: `trueOpeningFromTop`, `balanceBreaks`, `openingAnchorsAgree`).

---

## Important caveat on "verified"

Everything this session was checked three ways: **esbuild compile** (clean), a **Node logic harness** against the real Lloyds + HSBC numbers, and — crucially — **Stephen's live run** on the real PDFs, where all statements reconciled. Two honest limits remain:

1. The integrity check **catching** a dropped line is *certain* — it's arithmetic, it can't miss. Whether asking for the balance column also makes the model **drop fewer lines in the first place** is *suggested* by today's run but only the Phase 2 benchmark measures it.
2. "Reconciled" is partly back-solved, so a green tick is **necessary but not sufficient** proof the data is perfect. The integrity check makes a green tick far more meaningful (a silent drop now turns it red), but the real accuracy verdict comes from Phase 2's corrections-per-100, not the badge.

---

## Built and live-verified this session

**The one idea:** ask the model to *transcribe* the running-balance printed on each row (not calculate it), then let deterministic code do all the checking. Reading numbers off a page is what models do reliably; arithmetic is what code does reliably — each got the job it's good at.

Five linked edits:

1. **Prompt** — added a `balance` field to the transaction schema; rule to copy the printed running balance exactly (signed; null where no balance is printed on that row); *do not calculate it*. Reworded the opening-balance rule so the model returns the summary figure as printed and leaves correction to the app.
2. **Parser** — carries the new `balance` field through (coerced to a number or null).
3. **`recalc` — two-anchor true opening:** derives the true opening two independent ways — top-down (first printed balance − the movement up to it) and bottom-up (closing − net). Exposes `trueOpeningFromTop` and `openingAnchorsAgree`.
4. **`recalc` — per-row integrity check:** walks consecutive printed balances; if the transactions between two balances don't account for the change, records a `balanceBreaks` entry (a dropped row, or a direction flip, shows up here). Bank-agnostic; does nothing gracefully when no balances are present.
5. **Parse-time auto-apply + UI:** when both opening anchors agree and differ from the printed opening, the app applies the true opening **on load** — reconciles, no button, with the "brought forward — statement shows £X" note. A new red banner reports any integrity break: *"£X unaccounted between [date] and [date] — check the statement."* The manual opening button remains as the fallback when balances are absent or the two anchors disagree.

**Untouched (non-negotiables):** pinned model, `max_tokens: 32000`, robust JSON extractor (no prefill), `@`/`Visa Rate` foreign-transaction rule, UTF-8 BOM, the mandatory human approval gate. One general rule across all account types — no per-bank prompt library.

**State changes (for the instructions file):**
- Transaction object now also carries `balance` (number or null).
- Reconciliation object now also carries: `trueOpeningFromTop`, `openingAnchorsAgree`, `balanceBreaks` (array of `{fromDate, toDate, gap}`), `integrityChecked`.

---

## Open issues

- **Lloyds opening balance — RESOLVED.** Auto-corrects on load (£215.77 → £115.77), reconciles, no click. Verified live.
- **HSBC missing-transaction class — RESOLVED (detection).** The integrity check flags the exact span where a line is dropped or mis-entered. Verified on a dropped-row simulation; the full 26-row statement reconciles live.
- No blocking issues open.

---

## Working discipline added this session (Stephen's request)

After Claude narrated an unverified *cause* for the HSBC error with more confidence than earned, a guardrail was added to memory and is proposed for the instructions file:

> **Separate proof from guess.** State a finding as fact only when it's proven by arithmetic or verified in the live artifact. Anything reasoned from a screenshot or from logic alone is a hypothesis — label it as such, with a confidence level, and lead with the check that would confirm it rather than the explanation. *"What's wrong"* can stand on the numbers; *"why it happened"* needs evidence.

---

## Roadmap (sequenced)

**Phase 1 — extraction accuracy:**
- Item 1 — Lloyds opening balance ✅ **done** (this session).
- Item 2 — running-balance direction rule ⚠️ **partial**: the integrity check now *detects* a direction flip (flags it for human review); an explicit extraction-prompt rule to *prevent/auto-correct* direction (the HSBC Amazon-refund £4.99 case) was **not** added. Optional future prompt rule.
- Item 3 — credit card edge cases ❌ **not started**.
- Item 4 — duplicate detection tuning (treat repeated legitimate charges as review suggestions, not errors) ❌ **not started**.

**Phase 2 — controlled benchmark (outside the artifact):** 20 HSBC / 20 Lloyds / 20 Credit Card, processed through OpenAI and Anthropic, measuring **transaction count, debit total, credit total, reconciliation success, and — the metric that decides it — manual corrections required per 100 statements**. The running-balance prompt change built this session is exactly what this benchmark now measures. Run as a Node script with both API keys server-side; it is a measurement exercise, not an app feature.

**Phase 3 — provider abstraction in the standalone, only if Phase 2 earns it.** "Not before." A provider/model picker is an anti-feature for the product story (*Upload → review → approve → export*), so keep extraction engine invisible to the user.

---

## Option-2 prompt patch — preserved in full (for the record)

**Status note:** the *goal* of this patch is now achieved, but via the refined code-side route built this session (model transcribes the balance column; **code** derives and cross-checks the opening), NOT by having the model do the arithmetic. Kept here in full in case the prompt-side derivation is ever wanted, and because the memory references it. Do **not** re-implement the code-side derivation — it already exists.

> ## StatementAudit Pro Prompt Patch — True Opening Balance From Running Balance
>
> When extracting UK bank statements, do not assume that a summary figure labelled "Balance on [first date]" is the true opening balance. Some banks show the balance after the first transaction of the statement period, not the balance brought forward before the first transaction.
>
> Use this rule: if the transaction table includes a running balance column, derive the true opening balance from the first transaction row.
>
> For credit-positive accounts such as current and savings accounts:
> - If the first transaction is money in: `trueOpeningBalance = firstRunningBalance - firstTransactionCredit`
> - If the first transaction is money out: `trueOpeningBalance = firstRunningBalance + firstTransactionDebit`
>
> Example:
> Summary says: Balance on 01 December 2022 = £215.77
> First transaction says: 01 Dec 2022, Money In = £100.00, Running Balance = £215.77
> Therefore: `trueOpeningBalance = £215.77 - £100.00 = £115.77`
>
> Return: `openingBalance: 115.77`, `closingBalance: 103.72`, `statementPaymentsIn: 100.00`, `statementPaymentsOut: 112.05`
> Then reconcile: `115.77 + 100.00 - 112.05 = 103.72`
>
> If the summary opening balance differs from the derived true opening balance, do not use the summary figure as openingBalance. Store or mention it only as a printed balance note if required. The openingBalance field must always mean: the balance immediately before the first transaction in the extracted statement period.

**Claude's refinement (the route actually taken):** do not have the model do the arithmetic. Have it **return the raw running-balance column** (reliable transcription); let deterministic **code** derive the opening from the top AND cross-check against the closing-end derivation; if the two disagree, **flag it** (error detector) rather than silently committing (which hides misreads). This is now built.

---

## Decisions locked this session

- **Opening balance and integrity are solved in code, not the prompt.** The prompt's only new job is to transcribe the balance column. Deterministic, bank-agnostic, can't drift.
- **Stay single-provider** unless the Phase 2 benchmark earns a switch on corrections-per-100.
- **No model/provider picker in the product** — it undermines the "finished, trustworthy" story.
- **Standalone-era items** (unchanged): PDF side-by-side compare, full-width UI feel, provider abstraction.

---

## Instructions file — updates required next session (confirm before saving)

`STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` should be revised:
- Mark the Lloyds open issue **RESOLVED**.
- Add the running-balance pass to Features/State: balance-column capture; two-anchor opening auto-apply; per-row integrity check + banner.
- Add the new transaction field (`balance`) and reconciliation fields (`trueOpeningFromTop`, `openingAnchorsAgree`, `balanceBreaks`, `integrityChecked`) to the State section.
- Add **"Separate proof from guess"** to How We Work.
- Roadmap: record Phase 1 items 3 & 4 as remaining, and Phase 2 benchmark as the next move.

---

## Housekeeping

- Refresh the stored project copy of `statement-audit-pro.jsx` to the current **1,521-line** build (or commit to uploading the live file each session — drift bit us again this session).
- Deprecated `bank-statement-audit__1_.jsx` still flagged for deletion — confirm with Stephen before removing.

---

## Standing session rules (reminder)

Plan first · verify in the live artifact, not just a harness · human gate is non-negotiable · flag assumptions one at a time · minimum change · capture lessons · plain language · separate proof from guess · always advise and confirm before any file save or delete.
