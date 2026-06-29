# StatementAudit Pro
## Turning Bank Statement Processing from a Chore into a 90-Second Job

*Presentation for accounting and bookkeeping user groups · 2026*

---

## The Problem Every Practice Already Knows

You receive a client's bank statement as a PDF. You need the transactions in QuickBooks or Xero. Right now that means one of three things:

- Type them in manually — slow, error-prone, nobody's favourite afternoon
- Export from the bank and reformat a CSV — if the bank even offers it, the columns are wrong, the dates are wrong, the sign conventions are wrong
- Use a bank feed — great when it works, a mess when it doesn't, and useless for catch-up work on periods that are already closed

And regardless of which route you take, you still have to reconcile. The opening balance has to flow through to the closing balance, every debit and credit in the right column, before you can trust a single row of that data.

**That reconciliation step is where the time goes. It's also where the errors hide.**

---

## What StatementAudit Pro Does

Upload a PDF bank statement. The AI reads every transaction line, extracts dates, payees, amounts, and directions — then immediately checks its own work by running the numbers against the opening and closing balances printed on the statement itself.

It cannot produce an export file until the numbers reconcile. That is not a preference. It is the only button available.

> *"The reconciliation gate is the killer feature. It stops you exporting rubbish."*
> — Practice bookkeeper, user panel

The result: a correctly formatted CSV for QuickBooks Online or Xero, ready to import. No column mapping. No reformatting. No manual sign-flip.

**Typical human time per statement: under 90 seconds** — from upload to approved export.

---

## Two Pathways — One Tool

### Pathway 1 — Audit & Match
*For books that are maintained. Entries already exist, or will be matched on import.*

Upload → review → approve → export. The standard workflow. The CSV lands in QBO or Xero in the correct column order for immediate bank matching.

### Pathway 2 — Code & Create
*For empty periods. Catch-up work. New client onboarding. Missing months.*

The same extraction and reconciliation, plus a per-line coding step. You confirm an account code for every transaction — drawn from your payee memory for recognised merchants, or from the client's imported chart of accounts for new ones. The result is a single **precoded** import file: when you drop it into Xero, the transactions are created already coded and reconcile against the bank feed in one pass.

One file. One import. Catch-up month closed.

---

## What Makes It Different

**The gate is mandatory — not optional.** Most tools let you export whatever you have, correct or not. StatementAudit Pro does not. If the closing balance doesn't match, the export button does not exist. You fix the variance, or you don't export.

**Every edit recalculates live.** Change a transaction amount and the running balance column updates immediately across every subsequent row. You can see — row by row — whether your correction is right before you commit.

**It learns your clients.** Recognised payees are remembered across sessions: salary, rent, utilities, regular suppliers. On the next statement for that client, those lines come pre-suggested. The more you use it, the faster it gets.

**Confidence score on every statement.** Four tiers — High confidence · Good · Fair · Review — with a one-line explanation of exactly what to check. A statement with a disputed PDF balance scores differently from one that's clean. You know at a glance how much manual review is needed.

**The original PDF stays alongside.** Review the extracted table with the source document side by side. Spot a misread amount, click the cell, type the correction. No re-upload required.

**AI code suggestions for unknown payees.** When you open the coding screen, the app automatically suggests account codes for payees it hasn't seen before — shown as a purple proposal you click to accept. You still confirm every line; the suggestion saves the lookup time.

**UK VAT and Jersey GST built in.** Tax treatments (UK VAT 20%/5%/Zero/Exempt or Jersey GST) are per-line selectable in the coding screen and write directly into the Xero Tax Rate column on export. No manual tax column to maintain.

**Foreign currency flag.** Transactions mentioning a foreign currency (USD, EUR, AUD, etc.) are automatically flagged 💱 in the Review table. Open the coding screen for a free spot-rate lookup on the transaction date.

---

## Security — The Questions Clients Will Ask

| Question | Answer |
|---|---|
| Where does the statement go? | Sent over HTTPS for AI extraction. Not stored on the server after processing. |
| Who sees the transaction data? | Only you, in your browser. No shared database, no user accounts at this stage. |
| Is it stored anywhere? | In your browser's local storage by default. Connect your own Google Drive or OneDrive to persist across devices — your files, your account, we never see them. |
| Can someone else access my data? | No. Two people using the same URL see completely separate sessions. |

---

## Who It's For

**If you process 5 or more bank statements a month**, the time saving alone covers the cost.

**If you do catch-up bookkeeping** — new clients, missed periods, practice rescues — Pathway 2 changes the workflow entirely. Extract, code, one import.

**If you work across multiple clients**, the payee memory builds per-client knowledge that compounds over time. Recurring payees need less and less attention.

**If your team reviews client data before it goes into the books**, the Audit Workbook export gives you a two-tab Excel file — the full transaction register with running balance and expected balance columns side by side, and the clean import-ready data. Open it in Excel, run Copilot over it, hand it to a partner for sign-off.

---

## Where It Works

- **QuickBooks Online** — Pathway 1 (Audit & Match). Exports in QBO native column order. Banking → Upload → done.
- **Xero** — Pathway 1 and Pathway 2 (Code & Create). Standard import for matching; precoded import with UK VAT / Jersey GST for catch-up work.
- **Any modern browser** on desktop — Chrome, Edge, Safari, Firefox. Nothing to install.
- **Up to 50 statements per batch** — process multiple clients' statements in one session.
- **Multi-client Projects** — organise statements by client project; a dashboard tab shows approved/pending counts per project at a glance.

---

## Try It Yourself

No installation. No account required. Upload one of your own statements and see it live.

> Ask for a trial access link — enter the code on the welcome screen, upload a PDF, and the full workflow is yours to test. The trial allows three statements: enough to see extraction, reconciliation, edit, approve, and export end to end.

---

## The Honest Version

StatementAudit Pro is not magic. PDFs vary — handwritten amendments, scanned images, unusual formats — and the AI will occasionally misread a figure. That is why the gate exists: every extraction is verified by arithmetic before it can produce an output, and everything is editable before you approve.

What it eliminates is the *routine* work — the correct extractions that needed no correction but still took you twenty minutes to format and reconcile manually. That is the majority of statements. For those, 90 seconds is the realistic number.

For the ones that aren't clean, it finds the variance, shows you exactly where it is, and gives you the tools to fix it inline. Faster than reformatting a CSV from scratch. Much faster than typing it in.

---

*StatementAudit Pro · Built for UK accounting practices · 2026*
*Available on request — [contact for trial access]*
