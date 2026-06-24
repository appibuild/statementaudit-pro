# StatementAudit Pro — Project Briefing for Claude Chat
**Date:** 2026-06-24 · **Prepared by:** Claude Code (standalone build channel)

---

## What This Project Is

StatementAudit Pro is a UK/Jersey bank statement processing tool built for bookkeepers and practice managers. It converts PDF bank statements into reconciled, audit-gated CSV files for import into QuickBooks Online and Xero.

**The pipeline:**
> Upload PDF → AI extracts transactions as JSON → deterministic code reconciles → human reviews & edits → human approves (mandatory gate) → CSV export → user imports to QBO/Xero

**The primary competitor is DocuClipper** — a mature, well-funded US platform (10,000+ finance teams, SOC 2 Type II, $20–360/month per pages processed). DocuClipper is NOT a weak incumbent. It has: bank statements, invoices, receipts, brokerage, forms; rules-based transaction categorisation; fraud detection; QBO/Xero/Sage/NetSuite integrations; API & webhooks; Google Drive/Dropbox/Gmail ingestion; project/folder organisation; and document storage.

**Where DocuClipper is weak for our market:**
- US-centric throughout (USD, US banks, US categories — not UK nominal codes or UK payment types)
- Stores your documents on their servers (GDPR/JOIC risk for UK/Jersey practices)
- US-headquartered (data residency outside EEA)
- Per-page pricing becomes expensive at UK practice volumes
- Enterprise complexity (6 tabs, folders, tagging, fraud reports) for a workflow a UK bookkeeper needs to run in 10 minutes
- No mandatory audit gate — users can export without reviewing reconciliation

**What StatementAudit Pro does differently:**
- Mandatory human approval gate (only path to CSV — hard-blocked on non-reconciliation)
- 7-figure reconciliation strip visible before approval
- UK payment-type codes as a structured column (DD, BP, VIS, TFR, SO, etc.)
- UK-native: built for UK/Jersey bank formats, UK nominal codes, UK GDPR/JOIC compliance
- Zero document storage — PDFs never persisted; EU-hosted (Frankfurt)
- Balance break detection (walks printed balance column to flag missing transactions — more rigorous than DocuClipper's fraud check)
- Cross-statement duplicate detection
- Batch processing up to 20 statements

---

## Current Build State (2026-06-24)

- **Live at:** https://statementaudit-pro.onrender.com (Render Starter, Frankfurt/EU)
- **Tech stack:** Node/Express proxy (holds Anthropic API key) + React/Vite client
- **Model:** claude-sonnet-4-6 (pinned)
- **Verified live:** 10 statements processed (current account + credit card); QBO import VERIFIED end-to-end today
- **Line count:** 1,568 lines (canonical build in `src/statement-audit-pro.jsx`)

**The build is stable and deployed. We are now in the beta phase.**

---

## What the Beta Revealed Today

Stephen processed his own Lloyds Bank current account statement (Feb 2022, 4 transactions) through the live app and imported the CSV into QuickBooks Online. It worked cleanly — zero mapping errors, QBO auto-matched categories.

**Key insight from the beta:** Stephen noted that bank statements are 99.99% accurate — they always reconcile. So the reconciliation gate, while important for edge cases, is not the primary time-saver. The real bottleneck is the **QBO/Xero verification step**, where approximately 50% of transactions need manual payee identification before they can be categorised and posted.

**This means the next feature to build is nominal code / category suggestions** — not supplier invoices, not OAuth, not multi-user. If the app can suggest a nominal code or account category based on the extracted payee/description, the QBO verification step drops dramatically.

The Nominal Code field already exists in the export and the Review screen — it's just blank/manual today.

---

## The Board of Advisers (current membership — 8 members)

Amy Hoy · Jason Fried · UK Practice Manager · Paul Jarvis · David Ogilvy · Angus Cheng · Simon Willison · Compliance & Data-Protection adviser

---

## Strategic Questions for Claude Chat

**1. DocuClipper — customer intelligence**
We now have a clear picture of DocuClipper's features (see above). What we need is customer intelligence:
- What do DocuClipper's G2/Capterra reviews say customers value most — and complain about most?
- What does their pricing mean per statement at typical UK practice volumes (20 clients × 12-page statements/month)?
- Is there a vocal segment of their customers who are UK/international and frustrated by US-centric defaults?
- The original Claude Chat research on this was never committed to the repo — please reconstruct the key findings.

**2. Nominal code / categorisation feature — scope and design**
Given the beta finding (50% of payees need manual categorisation in QBO), what is the minimum viable categorisation feature? Options include:
- User-defined rules engine (if payee contains "Spotify" → suggest Nominal Code 7400)
- Model-inferred suggestions based on description/payee
- A hybrid (rules first, model fills gaps)
What does the board recommend, and what would the UK Practice Manager actually use?

**3. Commercial value and positioning**
The board consulted today agreed the app has value, but the nominal code gap limits the ceiling. With the categorisation feature added, what is the right price point? The prior analysis suggested Solo £25 / Practice £65 — is that still the right framing after what the beta revealed?

**4. Original project goals — supplier invoices and forensics**
Stephen's original vision included handling supplier orders/invoices and forensic reconciliation. The board today recommended not conflating invoices with bank statements (different product, different PDF structure). Do you agree? And is the existing balance-break + duplicate detection enough to claim a forensic angle, or does that need a separate feature set?

---

## Non-Negotiables (do not suggest changes to these)

- Human approval gate is the only path to CSV — no auto-approve
- Model transcribes; deterministic code does the arithmetic
- Pinned model (claude-sonnet-4-6); max_tokens 32000
- No assistant prefill
- Robust indexOf/lastIndexOf JSON extractor only
- UTF-8 BOM on export
- DD/MM/YYYY in display, prompts, CSV body
- One general rule per account type — no per-bank prompt library
- API key server-side only, never in client code
- Never persist real personal bank details

---

## What Claude Code Is Handling

Claude Code (this channel) owns: all file edits, commits, deployments, verify.sh, the standalone build. It does not replace strategic/marketing thinking — that's where Claude Chat adds most value.

The repo is at: `appibuild/statementaudit-pro` (private, GitHub). The canonical build instructions file is `docs/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md`.
