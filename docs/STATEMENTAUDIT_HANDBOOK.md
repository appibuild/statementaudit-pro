# StatementAudit Pro — User Handbook

**Purpose:** Upload a bank statement PDF → review and correct the AI extraction → export a clean CSV for QuickBooks or Xero. The app never lets you export until the numbers add up. This guide explains every feature and how to fix the errors you'll actually see.

**Updated:** 2026-06-29 — M365 Practice Workspace; Guide Mode tooltips; Module A: Jersey GST treatment + Xero Tracking Categories; GST Treatment column in Audit Workbook.

---

## The Workflow

```
1 Upload   →   2 Process   →   3 Review   →   4 Export
```

On arrival at Review you choose a pathway:

| Pathway | When to use | Export produced |
|---|---|---|
| **Pathway 1 — Audit & Match** | Books are maintained. Entries already exist (or will be matched). | Standard QBO / Xero CSV — platform matches on import. |
| **Pathway 2 — Code & Create** | Period is empty. No entries exist yet. Catch-up or rescue bookkeeping. **Xero only.** | Single precoded CSV — lands coded + reconciled in one Xero import. |

Both pathways go through the same approval gate. Numbers must reconcile before anything exports.

---

## The Review Screen — Feature by Feature

### The Confidence Badge

Displayed on every statement after processing. Shows how cleanly the AI reconciled the extraction.

| Badge | What it means |
|---|---|
| **⚡ High conf** (green) | Score ≥ 95 — passes every check: reconciled, row count agrees, no balance breaks, no date issues |
| **87 · Good** (amber) | Score 80–94 — reconciled but one or more minor checks flagged |
| **74 · Fair** (amber) | Score 70–79 — reconciled with moderate issues; worth a closer look |
| **62 · Review** (red) | Score < 70 — significant issues; review all rows before approving |

Hover the badge for a one-line summary of what lowered the score. Click the statement to open the detail view — the large badge there shows the full explanation.

**The approval gate does not require a specific score.** You can approve any statement that reconciles, regardless of confidence. The badge is a guide for how much manual checking to do.

---

### The Numbers Panel (top of screen)

| Field | What it means |
|---|---|
| **Transactions** | How many rows the AI found |
| **Opening balance** | From the statement. Click to correct if wrong. |
| **Money out / Money in** | Sum of your CSV's Debit / Credit columns |
| **Closing (worked out)** | Opening ± movements. Calculated, not read. |
| **Closing (on statement)** | What's printed on the PDF |

**These two closing figures must match.** If they do but the gate is still blocked, the issue is in the Statement Figures strip (see below).

---

### Statement Figures vs. Your CSV

Shows the statement's own printed totals (Payments Out / Payments In) against what your CSV adds up to.

**Example — figures match:**
```
                    Statement    Your CSV    Gap
Payments out        £5,501.18    £5,501.18    —
Payments in         £6,199.25    £6,199.25    —
```
Gap column shows dashes → reconciled.

**Example — figures don't match (Barclays YTD problem):**
```
                    Statement    Your CSV    Gap
Payments out        £5,127.54    £5,501.18    £373.64  ←  red
Payments in         £6,673.99    £6,199.25    £474.74  ←  amber
```
The statement is showing a different period's totals. Fix: **click the Statement figure** (it's underlined), type the correct number, press Enter. The gap drops to zero and the gate unlocks.

> The Statement figures are **audit-only** — they never appear in the CSV you export to QuickBooks/Xero. Correcting them here just satisfies the audit check; your transaction data is unchanged.

---

### The Balance Column (table, far right of amounts)

Every row shows its **printed balance** from the PDF, with a live indicator:

| Symbol | Colour | Meaning |
|---|---|---|
| `✓` | Green | Computed running balance matches printed balance — row is correct |
| `≠ £X,XXX.XX` | Amber | Mismatch — wrong amount, wrong direction, or OCR error in the printed figure |
| `£X,XXX.XX` (no indicator) | Grey | No printed balance on this statement — figure is the computed running total for reference |
| `—` | Grey | No opening balance, so running total can't be computed |

**This column updates live as you edit.** If you flip a transaction from debit to credit, the ✓ on that row turns green (or red) immediately.

---

### Editing a Transaction

Click any cell in the table to edit it. Fields you can change:

- **Date** — type DD/MM/YYYY
- **Type** — dropdown (DD, SO, VIS, BGC, etc.)
- **Description / Payee** — free text
- **Debit / Credit** — number only, no £ sign
- **Nominal code / Notes** — free text

Press **Enter** to save, **Escape** to cancel. Every edit re-runs the reconciliation instantly.

---

### Flipping a Transaction (Debit ↔ Credit)

When the AI puts a payment in the wrong column, an amber badge appears on the row:

> *Balance £1,038.61 → £1,008.61 (−£30.00) — recorded as credit, should be debit.*

Click **Accept** to swap it. The running balance corrects immediately.

You can also flip manually: click the Debit cell, clear it and type the amount, then clear the Credit cell (or vice versa).

**Example scenario:**  
Row 53 shows a £30 TRAINLINE payment in Credit (green). Balance went down by £30. The app flags it: money out can't make the balance go up. Click Accept → moves to Debit, balance ✓ turns green.

---

### Resetting a Single Row (↺ per row)

If you edited a row and want to undo just that row, click the **↺** icon at the far right of the row. The row reverts to the AI's original extraction. Recalc runs immediately.

> The ↺ column only appears when the statement has been edited (i.e., there's something to undo).

---

### Resetting the Whole Statement (↺ Reset edits)

Always visible in the review header. Greyed out when no edits have been made; amber when edits are present.

Click it → confirm → **all** edits are undone: transaction changes, opening/closing balance corrections, account type switches. Returns to the exact state the statement was in when it first loaded.

> **Important:** this does NOT undo the automatic opening balance fix (where the app detected the printed opening included the first transaction and corrected it). That fix is correct and stays.

---

### Rolling Back an Approved Statement (↺ Roll back to Review)

Once a statement is approved, a **↺ Roll back to Review** button appears on it. Click it to return the statement to Review status without re-running the extraction — all data, edits, and coding are kept. Useful if you need to correct something after approving.

---

### Correcting the Opening or Closing Balance

Click the **opening balance** or **closing (on statement)** figure in the Numbers panel. Type the correct value, press Enter.

**Example — Lloyds off-by-one-transaction opening:**  
Statement shows Opening £1,038.61 but the app calculates Opening should be £1,008.61. Click the opening, type 1008.61, Enter → variance drops to £0.

Sometimes the app detects this automatically (two-anchor check) and corrects it on load. You'll see a small note: *"Brought forward — your statement shows £X"*.

---

### The Approval Gate

The **⛔ Fix required** button stays red and locked until:
1. Closing (worked out) = Closing (on statement) — balance must close
2. Statement figures gap = £0 — CSV totals must match the statement's Payments Out/In (or you've corrected them)
3. No "Worth a check" ambiguous rows
4. No cross-statement duplicate

Once all four pass, the export buttons go live. For Pathway 1: **✓ Approve & Export**. For Pathway 2 (Xero): **✎ Code & Create** (see below).

---

### The Audit Workbook (↓ Audit Workbook)

Downloads an `.xlsx` file with three sheets:

| Sheet | What's in it |
|---|---|
| **Audit Review** | Full transaction register — date, type, description, payee, debit, credit, running balance, expected balance, category, nominal code, **GST Treatment** (Xero Pathway 2), notes, flags, receipt filename |
| **Xero / QBO Import (clean)** | Import-ready rows only — no audit figures |
| **Receipts** | List of transactions with attached receipts and their filenames |

**GST Treatment column (column 12):** Populated for Xero statements processed via Pathway 2. Shows the confirmed treatment for each line — Standard Rate (5%), Zero Rated (0%), Exempt, ISE Supply (>£1,000), or Outside Scope / No GST. Empty for non-Xero statements or statements not yet coded via Pathway 2.

The **Expected balance** column is new. It shows what the running balance *should* be based on the arithmetic. If it matches the Running balance column, the row is correct. If not, look at that row.

**Using with Microsoft Copilot:**
1. Export the Audit Workbook
2. Open in Excel, attach to a Copilot prompt: *"Check the reconciliation. Are Running balance and Expected balance in agreement? Where do they diverge?"*
3. Copilot will point you to the specific rows and columns. Because both figures are in the workbook, it can reason over the data precisely — this is exactly how the £545.50 sign-flip error was caught in the case study.

---

## Pathway 2 — Code & Create (Xero only)

Pathway 2 is for **empty periods** — months or quarters where no transactions have been entered in Xero yet. It produces a single precoded import file that creates the entries and reconciles them in one pass.

**When it appears:** The **✎ Code & Create** button is shown on Xero statements that have passed the approval gate. It does not appear on QBO statements (QBO's standard CSV import does not support coded imports on lower tiers).

**This is the only route to a precoded export.** The Export tab does not have a separate Pre-coded button. Every precoded file must go through the Code & Create modal so each transaction code is individually confirmed.

---

### The Coding Confirmation Modal

Clicking **✎ Code & Create** opens a full-screen coding screen with every transaction listed. You must confirm a code for every line before the export button activates.

**Columns:**
- **Date** — from the PDF
- **Payee / Description** — from the PDF; a "remembered" badge appears if the app has seen this payee before
- **Amount** — debit in red, credit in green
- **Account Code** — editable; pre-populated from payee memory or defaulting to Misc Revenue / Misc Expense
- **GST Treatment** — Jersey GST treatment for this transaction (Xero only; see below)
- **✓ toggle** — click to confirm both the code and treatment; click again to un-confirm

**To confirm a line:** Check the code is correct, select a GST treatment, then click the ✓ toggle. The row turns green.  
**To change a code:** Edit the Account Code field — confirming resets until you tick ✓ again.

---

### Auto-Confirm Remembered Payees (friction switch)

Tick **Auto-confirm remembered payees** to bulk-confirm all lines where a code is already remembered from a previous session. The "remembered" badge marks these lines.

This switch saves clicks on recurring payees — salary, rent, utilities — but does not confirm lines with unknown payees. You still review and confirm those manually. The gate requires all lines confirmed; this switch cannot bypass it.

---

### Jersey GST Treatment (Module A)

Each transaction on a Xero statement requires a GST treatment before it can be confirmed. The app pre-fills from memory (if you've coded this payee before), then requires you to confirm or change it.

**Treatments available:**

| Treatment | Rate | When to use |
|---|---|---|
| **Standard Rate (5%)** | 5% | Default for most goods and services supplied in Jersey |
| **Zero Rated (0%)** | 0% | Exports, residential property, prescription medicines, international services, ISE supplies >£1,000 |
| **Exempt** | — | Financial services, insurance, postal services, medical/paramedical (registered professionals), charities, education |
| **ISE Supply (>£1,000)** | 0% (treated as export) | Supply to a Jersey International Service Entity where the individual supply exceeds £1,000 |
| **Outside Scope / No GST** | — | Place of supply outside Jersey; goods supplied and remaining outside Jersey |

**Source:** Revenue Jersey — Goods and Services Tax (Jersey) Law 2007, Schedules 5 & 6.

**The treatment the app proposes is a suggestion, not a fact.** The product sources the law; you decide which treatment applies to each client transaction. If you are unsure, consult your client or a Jersey tax adviser before confirming.

**The ✓ toggle is disabled until a treatment is selected.** You cannot confirm a line without a GST treatment — this is the per-line gate.

**Treatment memory:** Confirmed treatments are remembered per payee/description. Next time you open a coding screen with the same payee, the treatment is pre-filled (but still requires your confirmation).

**GST Rule-Pack banner:** The controls bar shows the active rule-pack version and verification date. If the rule-pack is more than one year old, the precoded export is blocked — the banner shows this in red. To unblock: update `gstJersey.verifiedAt` in the source code after verifying the current rates at Revenue Jersey.

---

### Empty-Period Assertion

Before the export button activates you must tick: **I confirm this period has no existing transactions in Xero.**

This is a hard requirement, not a formality. Pathway 2 imports coded + reconciled transactions. If the period already has entries, Xero may create duplicates or fail to match. Pathway 2 is scoped to empty periods only.

---

### Chart of Accounts Import (📋 Import CSV)

The coding screen shows a **📋** chip in the controls bar. By default it shows "No chart loaded" — codes are drawn from payee memory only, defaulting to Misc Revenue or Misc Expense for unknown payees.

To load your client's real account taxonomy:
1. In Xero: **Accounting → Chart of Accounts → Export** (downloads a CSV)
2. In the coding screen: click **Import CSV** and select the file
3. Every Account Code input now autocompletes with `CODE — Name (Type)` suggestions from the chart

The chart persists in localStorage across sessions. Use **Replace** to swap it for a different client's chart, or **✕** to clear it. The chart is a lookup list only — the app never infers or auto-assigns codes; you still confirm every line.

---

### Xero Tracking Categories

If your client uses Xero Tracking (departments, properties, regions, cost centres), you can assign tracking options per transaction inside the coding screen.

**To load tracking categories:**
1. In Xero: **Settings → General Settings → Tracking** → click a category → **Export** (downloads a CSV)
2. In the coding screen: the **⚙ Tracking** panel is shown in the controls bar (Xero only). Click **Import CSV** and select the file.
3. A tracking sub-row appears beneath each transaction line showing optional selectors for each loaded category.

**Supported format — Xero Tracking Settings export:**
```
Tracking Category Name,Tracking Option
Department,Sales
Department,Marketing
Department,Administration
Region,North
Region,South
```

Up to two tracking categories are supported (Xero's Tracking1/Tracking2 limit).

**Key points:**
- Tracking is **optional** — it is not a confirmation gate. You can confirm a line and export without selecting tracking values.
- Confirmed tracking choices are **remembered per payee/description** across sessions. Next time you open a coding screen with the same payees, the tracking values are pre-filled.
- The exported precoded CSV (`_PRECODED.csv`) includes the Tracking1 and Tracking2 columns with the selected values. Xero assigns them to the transactions on import.
- Without a tracking CSV loaded, the Tracking1/Tracking2 columns export empty — this is valid; Xero accepts the import either way.

**Clearing or replacing:** Click **Replace** to swap in a different client's tracking file. Click **✕** to clear and revert to empty tracking columns.

---

### Exporting the Precoded File

Once all lines are confirmed and the empty-period box is ticked, **↓ Export Precoded CSV** activates. Clicking it:

1. Downloads the precoded CSV (filename ends `_PRECODED.csv`)
2. Approves the statement (moves it to Approved, saves confirmed codes to payee memory)
3. Closes the modal

**Importing into Xero:** Accounting → Bank Accounts → [account] → Import Statement → select the `_PRECODED.csv` file. Xero will create the transactions already coded and reconcile them against the bank feed lines in the same pass.

> **One file, one import.** Do not import a separate statement file alongside the precoded file — they will collide.

---

## Common Error Scenarios

### Scenario 1 — Statement figures mismatch (Barclays / multi-period statements)

**Symptom:** Balance closes correctly (✓ on all rows), but gap shows in red under Payments Out / In.  
**Cause:** Bank printed YTD or different-period totals in the summary section.  
**Fix:** Click the Statement figure, type the matching value from your CSV total, Enter.

---

### Scenario 2 — Wrong direction (debit booked as credit)

**Symptom:** Amber flip suggestion on a row. Running balance jumps the wrong way.  
**Fix:** Click **Accept** on the amber badge. Or: click the Credit cell, cut the value, paste into the Debit cell.

---

### Scenario 3 — Wrong opening balance

**Symptom:** Every row's ✓/≠ is fine but the overall variance equals a round number near the first transaction.  
**Fix:** Click the opening balance, type the corrected figure. Often the app has already done this automatically on load.

---

### Scenario 4 — Count mismatch (AI found more/fewer rows than text layer)

**Symptom:** Blue ⊕ badge: *"AI read 66, text layer read 53 — 13 rows may be missing."*  
**What it means:** The two extraction methods disagree. Check both counts against the actual statement page count.  
**Fix:** Scroll through all rows. If all transactions are present and the balance closes, the count difference is likely a known format quirk (e.g., Barclays summary box). The Balance column ✓ is your proof the data is correct.

---

### Scenario 5 — Duplicate detected

**Symptom:** A row is highlighted in red with a duplicate warning. Gate is blocked.  
**Fix:** Compare the flagged row against the statement. If it's genuinely a duplicate, delete it (✕). If it's a legitimate repeated payment, flag it (⚑) and leave it.

---

### Scenario 6 — Code & Create: "Export Precoded CSV" stays greyed out

**Symptom:** You've entered codes but the export button won't activate.  
**Checklist:**
1. Every row must have its ✓ toggle ticked — a line with an un-ticked toggle blocks export
2. The empty-period assertion box must be ticked
3. No line can have a blank Account Code field (enter a code first, then confirm)
4. Every Xero row must have a GST Treatment selected — the ✓ toggle is disabled until one is chosen
5. The footer message will tell you exactly which condition is blocking export (lines not confirmed / GST treatment missing / empty-period not ticked / rule-pack expired)

> **Note on tracking:** Tracking categories are optional and are NOT a gate. A missing tracking value will not block export.

---

---

## Cloud Storage & Practice Workspace

### Personal Cloud Save (Google Drive or OneDrive)

Connect via the **☁ Cloud** button in the top bar. Once connected, every approved statement auto-saves as a JSON file to a private app folder. Reconnecting from any browser restores all your previous statements automatically.

**One-time setup required:** you need to register the app in Google Cloud Console (for Drive) or Azure Portal (for OneDrive) and add the Client ID as a Render environment variable. The numbered setup steps are inside the Cloud panel — expand the relevant "Setup" accordion.

---

### Practice Workspace (Microsoft OneDrive / M365 only)

A shared OneDrive folder that the whole practice team accesses through StatementAudit Pro. **Shared across the workspace:** payee code memory, category memory, Jersey GST treatment memory, tracking categories, chart of accounts.

**Admin flow (sets up the workspace):**
1. Connect to OneDrive via ☁ Cloud
2. In the Cloud panel, under **Practice Workspace**, click **+ Create workspace**
3. Enter a name (e.g. "Smith & Co") → Create
4. Open OneDrive, find the new folder, right-click → **Share → Anyone with the link can edit → Copy link**
5. Give that link to colleagues

**Colleague flow (joins an existing workspace):**
1. Connect to OneDrive via ☁ Cloud
2. In the Cloud panel, click **Join workspace**
3. Paste the share link the admin gave you → Join
4. The app loads the shared memory and any existing statements from the workspace folder

**Key rules:**
- The share link must be set to **"Anyone with the link can edit"** (not view-only)
- Memory auto-pushes to the workspace every time you export — colleagues see the latest rules next time they open the app
- Workspace mode and personal save are mutually exclusive: when a workspace is active, statements save to the workspace folder. Leave the workspace to revert to personal save
- This is NOT the same as multi-user login — each person connects with their own Microsoft account; there are no shared passwords

---

## Guide Mode

Click the **💡 Guide** button (top-right toolbar) to turn on hover tooltips. When Guide Mode is on, hovering any button, tab, or dropdown shows a plain-English explanation of what it does and how it fits into the workflow. The button turns green when active. Your preference is saved between sessions.

Turn it off by clicking **💡 Guide** again.

---

## Quick Reference

| Action | How |
|---|---|
| Edit any cell | Click the cell |
| Flip debit ↔ credit | Click **Accept** on amber badge, or edit cells manually |
| Correct opening/closing balance | Click the figure in the Numbers panel |
| Correct Payments Out/In | Click the underlined Statement figure in the strip below |
| Reset one row | Click ↺ at end of that row |
| Reset all edits | Click **↺ Reset edits** in the header (greyed when nothing to reset) |
| Roll back an approved statement | Click **↺ Roll back to Review** on the approved statement |
| Download audit workbook | Click **↓ Audit Workbook** in the header |
| Approve and export (Pathway 1) | Click **✓ Approve & Export** (only active when reconciled) |
| Open coding screen (Pathway 2) | Click **✎ Code & Create** — Xero statements only, reconciled only |
| Load chart of accounts | In coding screen: click **📋 Import CSV** → select Xero CoA export |
| Export precoded CSV (Pathway 2) | Confirm all lines + pick GST treatment for each + tick empty-period box → **↓ Export Precoded CSV** |
| Load tracking categories | In coding screen: click **⚙ Import CSV** in the tracking panel → select Xero Tracking export |
| Assign tracking per transaction | Select from the tracking sub-row beneath each coding line (optional) |
| Turn on tooltips / Guide Mode | Click **💡 Guide** in the top-right toolbar (turns green when active) |
| Create practice workspace | ☁ Cloud → Connect OneDrive → Practice Workspace → + Create workspace |
| Join practice workspace | ☁ Cloud → Connect OneDrive → Practice Workspace → Join workspace → paste share link |
| Save cloud payee rules backup | Export tab → Payee Code Memory → **↓ Save Rules** → store the .json file safely |
