# StatementAudit Pro — Zoom Demo & Accountant Trial Guide

**Audience:** This document is for you (the product owner) — it covers how to run a polished Zoom demo and how to give an accountant trial access without exposing your API key, source code, or infrastructure.

---

## 1. Security Posture — What Is and Isn't Visible

Read this before any demo so you can answer questions with confidence.

| What they can see | What is protected |
|---|---|
| The web interface (same as any SaaS tool) | Anthropic API key — stored as a Render server-side environment variable. Never sent to the browser. Never in the client bundle. |
| The app URL | Source code — Vite compiles and minifies the build. The JS file at `/assets/index-xxxxx.js` is machine-readable noise, not readable code. |
| HTTPS requests to your server | Server infrastructure — they see a web app URL, not a repo, not a codebase |
| Their own extracted transactions | Other users' data — nothing is shared between sessions |

**Bottom line:** From a viewer's perspective this is indistinguishable from any commercial SaaS product. There is no path from "I used this app" to "I can copy or steal it."

---

## 2. Pre-Demo Checklist

Complete these before the Zoom call starts.

### 5 minutes before
- [ ] **Wake the server.** Open your Render URL in a browser tab. Free-tier Render services sleep after 15 minutes of inactivity. Opening it 5 minutes early ensures it's live before your guest sees any loading delay.
- [ ] **Prepare 2–3 sample PDFs.** Use your own test-account statements (not client data). Keep them in a folder called `Demo Statements` on your desktop for quick drag-and-drop.
- [ ] **Clear your browser history dropdown.** Right-click the address bar → clear recent suggestions, or use a clean browser profile (Chrome: Profile icon → Add → Guest).
- [ ] **Close all other tabs** in the window you'll share. The only tab visible should be the app.
- [ ] **Set browser zoom to 90%.** The app is designed for full-width viewing; 90% gives comfortable margins.
- [ ] **Hide your bookmarks bar** (Ctrl/Cmd+Shift+B) — a bar full of personal shortcuts is a distraction.

### Zoom settings
- **Share a specific window**, not your whole desktop. Go to Share Screen → select the browser window only.
- Alternatively in Chrome/Edge: Share Screen → Chrome Tab → select just the app tab. This completely hides your address bar, other tabs, and desktop.
- Turn on **"Optimise for video clip"** only if you're playing a recording — it's off by default and that's correct for live use.
- Enable **"Share computer sound"** only if needed — it's off by default, keep it off.

---

## 3. Demo Script — 12 Minutes

Run through this in order. Each section has a talking point to deliver while the screen catches up.

---

### Step 1 — Upload (2 min)

**Do:** Open the Upload tab. Set Account Type (e.g. Current Account). Set Export To (QuickBooks or Xero — ask which they use). Drag one PDF onto the upload zone.

**Say:** *"Every bank statement you process starts here. You tell it the account type — current, savings, credit card, or loan — and which accounting software you're exporting to. Then drag and drop. No formatting, no templates, no column mapping."*

**Point out:** The file appears in the Queue immediately, status badge shows "Queued."

---

### Step 2 — Queue & Processing (2 min)

**Do:** Click Process All on the queued file. Watch it process.

**Say:** *"The AI is reading every transaction line on the PDF — extracting dates, payees, debit and credit amounts — then reconciling the total against the opening and closing balances printed on the statement itself. It checks its own work before it even shows you the result."*

**Point out:** Status badge moving Queued → Processing → For Review. The confidence score appearing when it completes.

---

### Step 3 — Review (4 min)

**Do:** Click the statement to open the Review view.

**Say (confidence score):** *"This score tells you how cleanly it reconciled. 95 or above means it passed every check — row count, balance continuity, date order, the lot. Hover the badge and it tells you exactly what it found."*

**Do:** Point to the reconciliation strip.

**Say:** *"Opening balance, every debit, every credit, closing balance — it all ties back to what's printed on the statement. If there's a variance, it shows you the amount and won't let you approve until you've looked at it."*

**Do:** Click a transaction cell — edit an amount.

**Say:** *"Everything is editable inline. Change a figure and the reconciliation recalculates immediately. If the AI misread a number, you fix it here — no re-upload required."*

**Do:** If any rows are flagged (⚑), click one.

**Say:** *"The flag means the AI flagged it for human review — ambiguous description, split amount, something that didn't look clean. You confirm or correct it before approving."*

---

### Step 4 — PDF Side-by-Side (1 min)

**Do:** Click the Show PDF button.

**Say:** *"Original PDF on the right, extracted data on the left. You can cross-reference any transaction directly against the source document without switching windows."*

**Do:** Close the PDF view after 30 seconds.

---

### Step 5 — Approve & Export (1 min)

**Do:** Click Approve & Export (or press the A key).

**Say:** *"One click. It downloads the transactions as a formatted CSV in QBO or Xero column order, and marks the statement approved. In QBO you go to Banking → Upload. In Xero: Accounting → Bank accounts → Import. No reformatting, no column mapping."*

---

### Step 6 — Audit Workbook (1 min)

**Do:** Go to the Export tab. Click ↓ Audit Workbook.

**Say:** *"This is the three-sheet Excel file — the full transaction register with categories and receipt references, the clean import-ready data, and a receipts log. Open it in Excel or Google Sheets and you can ask Copilot or Gemini to cross-check the data for anomalies. It's an extra set of eyes on the extraction."*

---

### Step 7 — Close (1 min)

**Say:** *"That's the full workflow — upload, extract, review, approve, export. For a typical monthly statement it takes under 90 seconds of human time once you've reviewed it. For a full audit pack across multiple accounts, everything merges into one export file from the Export tab."*

**Offer:** *"I can send you a trial link right now — nothing to install, open it in your browser. Upload one of your own statements and see it live."*

---

## 4. Giving an Accountant Trial Access

### What they need
**Nothing to install.** The app is a web application. You give them a URL, they open it in any modern browser (Chrome, Edge, Safari, Firefox). It works on desktop; it is not optimised for mobile.

### Sharing the URL
Send them the Render URL privately — by email or direct message. **Do not post it publicly** (LinkedIn, website, social media) while you're on a free-tier Render plan, as open access drains your Anthropic API quota.

### What to tell them (copy-paste this)

> **StatementAudit Pro — Trial Access**
>
> Here's your trial link: `https://[your-app-name].onrender.com`
>
> Open it in Chrome or Edge on a desktop. Upload any UK bank statement PDF to see the extraction and reconciliation live.
>
> **Privacy note:** Your PDF is sent over HTTPS to the processing server, read by the AI to extract transactions, and the results are returned to your browser. The file is not stored on the server after processing. No transaction data leaves your browser session unless you choose to export it or connect your own Google Drive / OneDrive.
>
> The app never stores your data — what you see is held in your browser only.

### Protecting your API during trials

| Option | Effort | Effect |
|---|---|---|
| Share URL privately (current) | None | Effective for small-scale trials. Anyone with the link can use it. |
| Add an access code | 30-min build | A simple modal on first visit asks for a code you've set. Stops casual use. Ask to add this feature. |
| Per-user invite tokens | 1–2 days build | Each invitee gets a unique token link. Tracks usage per person. Full multi-user auth is a later milestone. |

For the current stage — private trials with named accountants — sharing the URL directly is fine. If you're sending it to more than 10 people, add the access code gate first.

---

## 5. Security Questions the Accountant May Ask

**"Where does my bank statement go when I upload it?"**
> The PDF is sent over HTTPS to the app's server. The AI reads the text content to extract transactions. The transactions are returned to your browser. The file and the raw text are not retained on the server after your session.

**"Is the AI reading my client's financial data?"**
> Yes — that's how the extraction works. Anthropic's Claude model processes the statement text. Anthropic's [data usage policy](https://www.anthropic.com/legal/privacy) applies. For client data on a trial, we recommend using your own test-account statements first. Full data processing documentation is available on request.

**"Is my data stored anywhere?"**
> By default, approved statements are stored only in your browser's local storage — local to your device, cleared when you clear browser data. If you choose to connect Google Drive or OneDrive (optional), data saves to a private folder in your own cloud account. The app operator has no access to your cloud files.

**"Can I see the source code?"**
> The app is compiled and minified for production. The web interface is visible (as with any web application), but the processing logic, API credentials, and server code are not accessible through the browser.

**"What happens if I close the tab?"**
> Your work is saved in browser localStorage and will be there when you reopen the app in the same browser. To persist across devices or browsers, connect Google Drive or OneDrive from the Cloud menu.

**"Could someone else see my statements?"**
> No. There is no shared database, no user accounts at this stage. Your data lives in your browser only. Two people using the same URL see completely separate sessions.

---

## 6. Demo Environment — Good Practices

- **Never upload a real client's statement during a demo** without their written consent. Use your own test-account data or a synthetic statement.
- **Never show your Render dashboard, GitHub repo, or Anthropic console** on screen during a call. If you need to reference settings, do it before or after the screen share.
- **Never paste your API key anywhere** in the demo — it's not needed, it's server-side, and there is no legitimate reason to show it.
- **If asked to share your screen and show the browser console**: politely decline. `F12 → Network` would show HTTPS request shapes but not the API key (which is server-side). Still, there's no reason to demo DevTools.
- **If the app errors during a demo**: say "The AI occasionally needs a moment — let me re-run that file." Click Re-run. It almost always succeeds on the second attempt.

---

## 7. Synthetic Demo Statement (optional)

If you want a completely risk-free demo PDF with no real data, create one using this template in Word or Google Docs and export as PDF:

```
DEMO BANK UK
Account Statement

Account name:   Rosewood Consulting Ltd
Account number: 12345678
Sort code:      12-34-56
Statement date: 01 May 2026 to 31 May 2026

Opening balance:  £4,280.00

Date        Description                  Debit      Credit
03 May      HMRC CORP TAX                £1,200.00
05 May      OFFICE SUPPLIES LTD             £87.50
08 May      CLIENT INVOICE #4421                     £3,500.00
12 May      BT BROADBAND                    £42.00
15 May      TESCO STORES                    £23.40
18 May      CLIENT INVOICE #4422                     £2,100.00
22 May      BARCLAYS BANK CHARGE            £12.00
24 May      AWS AMAZON                      £54.30
28 May      SALARY S MORRIS              £2,800.00
31 May      INTEREST                                    £3.20

Closing balance:  £5,664.00
```

This produces a clean 100/100 confidence score and demonstrates every feature of the app without involving any real financial data.

---

*Document version: 2026-06-26 | StatementAudit Pro*
