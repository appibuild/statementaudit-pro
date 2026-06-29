# AuditPro Board Brief — Proven Converter & Audit-Workbook Reconciliation

**Date:** 25 June 2026
**Author:** Stephen Morris
**Purpose:** Present the working personal converter (R&D sandbox) to the AuditPro build for review, so the proven extraction, audit and reconciliation logic can inform the commercial product.
**Boundary note:** The personal converter remains personal-use only and is never a commercial dependency. What follows is *proven logic to port*, not a system to integrate. This is the established R&D-sandbox → AuditPro pattern.

---

## 1. Why this is in front of the board

A live reconciliation error was caught and corrected end-to-end this week using nothing more than the converter's output plus a general-purpose AI assistant reasoning over it. The error was a classic bookkeeping sign-flip — two payments-out booked as credits — and the workflow isolated it to two specific cells, explained the cause, and produced a clean, reconciled import file.

The point for AuditPro is not the converter itself. It is the **audit-workbook export pattern** that made the error machine-diagnosable. This is directly relevant to AuditPro's core differentiator: the mandatory human audit gate. The same pattern gives AuditPro an audit artefact that both a human reviewer *and* an AI can reason over — without adding any server cost or storage, which keeps it inside the zero-storage positioning.

---

## 2. How the converter works (feature walkthrough)

The converter is a local Node/Express app with a single-page frontend. A PDF goes in; a QBO-ready file comes out. The pipeline has four stages.

**Extraction.** The PDF is sent to the Claude API with one of six account-type prompts (bank/current, savings, business, credit card, mortgage/loan, foreign currency). Each prompt enforces its own CSV schema, payment-type set, and handling rules — for example, foreign transactions containing "@" or "Visa Rate" are never dropped and are classed as VIS with the GBP amount retained. Every prompt appends a standard `META` block carrying the statement's own figures: period, opening/closing balance, net change, **Payments Out**, **Payments In**, transaction count, statement type, currency, and a reconciliation flag.

**Display and live audit.** Extracted rows render in an editable table. Every cell is editable, and edits recompute totals, variance and reconciliation status live. This is the heart of the audit gate: the human can correct any value before anything is exported.

**Reconciliation engine.** The `META` block's Payments Out / Payments In pre-fill two editable "statement figure" boxes. The app sums the table's Debit and Credit columns and compares them to those figures. A variance badge shows the delta per side, and a status cell reads **Reconciled** (green) only when both sides match to within a penny. Crucially, the statement figures are audit-only — they are never written into the export file.

**Export — two separate files, by design.** The import file (CSV) and the audit file are deliberately distinct:

- **QBO CSV** — real transaction rows only, correct column order, UK dates, signed amounts where the platform needs them (e.g. the credit-card single signed `Amount` column, charges negative, credits positive). Ready for import with no further cleaning.
- **Audit workbook (.xlsx)** — generated client-side from the live table using ExcelJS. It contains an **Audit Review** tab (transactions plus statement figures, live totals, labelled variance and a STATUS cell) and a **QBO Import (clean)** tab that derives itself from the reviewed data. Because it is built from the live table, any correction made in the app is already baked in, and the workbook opens reconciled.

The two-file separation is what turns a flat extract into something auditable. A CSV gives a reviewer (human or AI) nothing to reason over; the workbook hands them live totals beside statement figures, an isolated variance, and the transactions underneath in a clean grid.

### Account types at a glance

| Type | CSV schema | Notes |
|------|-----------|-------|
| Bank (current) | Date, Payment Type, Description, Payee, Debit, Credit | DD/BP/SO/VIS/CR/TFR |
| Savings | same | TFR/CR primary |
| Business | same | adds CHAPS/BACS/FPS/CHQ/BGC |
| Credit card | Date, Description, Amount (signed) | negative = charge, positive = credit/payment |
| Mortgage/loan | Date, Description, Payment, Interest, Principal, Balance | reference record, manual split in QBO |
| Foreign currency | Date, Payment Type, Description, Payee, Debit, Credit | native currency, no GBP conversion |

---

## 3. The reconciliation case study (what was just done)

This is the process the board should focus on, because it is the proof.

**Step 1 — Convert and export.** An HSBC statement was processed and the audit workbook exported from the live table.

**Step 2 — Hand the workbook to an AI assistant.** Microsoft Copilot was pointed at the workbook and asked to check the reconciliation. Because the workbook gave it structure — live totals beside the statement figures, a labelled variance that already isolated the discrepancy, and the transactions in a clean grid — it could reason over the file rather than guess.

**Step 3 — Error isolated to two cells.** Copilot pinpointed the problem to two specific rows and named a variance of **£545.50**. Two payments-out had been booked into the Credit column instead of Debit: R G Hetherington (£500.00) and Sophia Nash Bills (£45.50).

**Step 4 — Why the variance mirrored.** A sign-flip double-counts. Booking a payment-out as a credit both inflates Payments In by £545.50 *and* understates Payments Out by £545.50 — which is exactly why both sides showed a ±£545.50 variance, mirror images of each other. That mirrored pattern is itself a diagnostic signature of a misclassified-direction error.

**Step 5 — Correct and re-reconcile.** On the Audit Review tab, the two amounts were moved from the Credit column to the Debit column. Both variances snapped to £0.00, the STATUS cell flipped green to **Reconciled**, and the QBO Import (clean) tab updated itself. That clean tab was exported as the final CSV.

**Outcome:** a genuine bookkeeping error caught before import, corrected inside the audit artefact, with a reconciled clean file as the end state. No data left the local machine beyond the single AI call.

---

## 4. What AuditPro should take from this

1. **Ship two artefacts, not one.** Keep the import CSV and the audit workbook separate. The import file stays clean; the audit file carries the structure that makes review possible. This reinforces AuditPro's audit-gate differentiator rather than competing with it.
2. **Make the audit file machine-readable as well as human-readable.** Live totals beside statement figures, a labelled variance, and a clean transaction grid are what let an AI (or a junior bookkeeper) locate an error precisely. Design the workbook layout deliberately for that.
3. **Client-side generation fits the zero-storage model.** The workbook is built in the browser from data already in memory — no server processing, no stored document. This is the same client-side discipline already proven on the credit-card signed-amount fix, and it is exactly how AuditPro can offer an audit-workbook export without breaking the zero-storage privacy positioning that distinguishes it from DocuClipper.
4. **Surface mirrored variances as a hint.** Equal-and-opposite Payments In / Payments Out variances almost always mean a misclassified-direction (sign-flip) error. AuditPro could flag that signature automatically and point the reviewer at the candidate rows — a small feature with high audit value.

---

## 5. Files to share for the review

Share these three. Skip the rest, and do **not** share `config.json` (it holds the API key in plaintext).

| Share? | File | Why | Caveat |
|--------|------|-----|--------|
| ✅ | **This brief** (`AUDITPRO_BOARD_BRIEF_…20260625.md`) | The narrative and the recommendations | — |
| ✅ | **`index.html`** | The working implementation: editable audit table, variance engine, two-file export | ⚠️ The copy in this project is the **2026-06-08** version. It has the live audit/variance logic but **not** `downloadAuditWorkbook` (the ExcelJS export). Upload the **current live file from your Mac** so the board sees the workbook export that this whole case study depends on. |
| ✅ | **`CONVERTER_APP_HANDOVER_20260608.md`** | Architecture, six schemas, META block, lessons learned | Note it predates the workbook feature; this brief fills that gap. |
| ➖ | `exceljs_min.js` | It's just the vendored library | AuditPro should `npm install exceljs` rather than carry a copy. No need to share. |
| ➖ | `HSBC_…_QBO_csv.txt` | A sample output | Optional — include only if the board wants a concrete sample. A sample **audit workbook** would be more illustrative than the CSV. |
| ❌ | `config.json` | API key in plaintext | Never share or commit. |
| ➖ | Claude Projects QuickStart / Playbook docs | Project-admin docs, not converter logic | Not relevant to this review. |

**One thing to do before the review:** re-export a fresh audit workbook (.xlsx) from the live app — ideally the reconciled one from the case study — and add it to the share. A real workbook the board can open will make the two-file pattern land far better than any description.

---

## 6. Verification note

To confirm the live `index.html` you upload actually contains the workbook export before sending it for review:

```
grep -c "downloadAuditWorkbook" "/Users/stephenmorris/Desktop/Apps/PDF_Bank_Statement_to CVS/hsbc_converter/public/index.html"
```

A result greater than 0 means it's the right file. (Remember: Finder for any file moves in this folder — the space in the path makes Terminal `cp` fail silently.)
