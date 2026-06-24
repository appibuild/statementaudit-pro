# StatementAudit Pro — Project Briefing for Claude Chat
**Date:** 2026-06-24 · **Prepared by:** Claude Code (standalone build channel)

---

## What This Project Is

StatementAudit Pro is a UK/Jersey bank statement processing tool built for bookkeepers and practice managers. It converts PDF bank statements into reconciled, audit-gated CSV files for import into QuickBooks Online and Xero.

**The pipeline:**
> Upload PDF → AI extracts transactions as JSON → deterministic code reconciles → human reviews & edits → human approves (mandatory gate) → CSV export → user imports to QBO/Xero

**The primary competitor is DocuClipper** — a mature, well-funded US platform (10,000+ finance teams, SOC 2 Type II). Trusted by Deloitte, PwC, KPMG, EY, BDO. DocuClipper is NOT a weak incumbent. It has: bank statements, invoices, receipts, brokerage, forms; rules-based transaction categorisation; fraud detection; QBO/Xero/Sage/NetSuite integrations; API & webhooks; Google Drive/Dropbox/Gmail ingestion; project/folder organisation; document storage; and batch processing of 50+ documents at once.

**DocuClipper pricing (confirmed):** $20/mo for 60 pages firm-wide (entry tier). Flat monthly, not per-token.

**Critical competitive intelligence — DocuClipper vs Claude page:**
DocuClipper runs a dedicated comparison page titled "Claude reads a PDF. DocuClipper reconciles and exports it." They list exactly what raw LLMs get wrong: hallucinated amounts, no reconciliation check, markdown table output (not QBO/IIF/CSV), no batch mode, public chat tool compliance risk, per-token cost at volume. **StatementAudit Pro has solved every one of these criticisms** — reconciliation gate, proper CSV/QBO export, server-side key (never a public chat tool), batch up to 20 statements, and structured JSON extraction that eliminates hallucination risk. We are the thing DocuClipper says you can't build with Claude. That is a strong story.

**G2 review themes (from DocuClipper's own site):** Customers praise ease of use, time saved at tax season, reliability vs free AI tools. Complaints are not visible here — Claude Chat should search G2/Capterra for the complaint patterns. Named reviewers include: Adam M. (Aspire), Julia J. (Accountant), Jeanette A. (Quality Management), Jakkie H. (Managing Member and Trustee).

**Jersey intelligence:** Sally Tinkler, Director at Hawksford, is a named DocuClipper customer. Hawksford is a Jersey-based trust and corporate services firm. DocuClipper already has a Jersey foothold.

**Where DocuClipper is weak for our market:**
- Claims "deep US/UK/CA bank coverage" for format extraction — but UK nominal codes, UK payment types (DD/BP/SO/TFR), and UK/Jersey compliance (GDPR, JOIC, sub-processor obligations) are not addressed
- Categorisation uses US GAAP account names (Transfer, Rent, Software, Revenue, Interest Income) — not UK nominal codes. UK users must upload a Vendor Categorisation CSV as a workaround to map their own categories; it's manual and not pre-built for UK nominal codes
- "Debits and Credits Are Backwards" is a documented troubleshooting article — their extraction has a known debit/credit orientation problem for non-US banks
- "Dates Show as NaN or #VALUE! in Excel" is a documented issue — UK DD/MM/YYYY is misread as MM/DD/YYYY in their exports
- Categorisation does not run automatically — users must manually trigger it (their own help docs confirm: "Why Categorization, Transfers, and Recurring Don't Run Automatically")
- Stores your documents on their servers (GDPR/JOIC risk — data retention is "configurable" but documents are still uploaded and held)
- US-headquartered (data residency outside EEA by default)
- Client base is weighted toward large US accounting firms, lenders, and underwriters — not small UK/Jersey bookkeeping practices
- Enterprise complexity (folders, tagging, fraud reports, multi-seat workspaces) for a workflow a UK bookkeeper needs to run in 10 minutes
- No mandatory audit gate — users can export without reviewing reconciliation; "review anything flagged" is optional
- "Fraud Detection" is reconciliation confirmation only ("Reconciled" badge + "No fraud signals detected") — not a row-by-row balance walk

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

**1. DocuClipper — complaint patterns and UK/Jersey customer frustration**
We now have a detailed picture of DocuClipper's features, pricing ($20/mo for 60 pages), and marketing (they run a "vs Claude" page). What we still need:
- What do G2/Capterra reviews say customers complain about most? (Hypothesis: US-centric categories, document storage/privacy concerns, complexity for small firms, support quality)
- Is there a vocal segment of UK or international customers frustrated by US-centric defaults, US nominal codes, or data residency?
- Hawksford (Jersey trust firm) is a named customer — does that signal Jersey practices are actively using DocuClipper and hitting limits?
- What does $20/mo for 60 pages actually mean for a Jersey practice with 20 clients × 12-page statements = 240 pages/month? What tier does that hit?
- The original Claude Chat research on this was never committed to the repo — please reconstruct the key findings.

**2. Nominal code / categorisation feature — scope and design**
Given the beta finding (50% of payees need manual categorisation in QBO), what is the minimum viable categorisation feature? Options include:
- User-defined rules engine (if payee contains "Spotify" → suggest Nominal Code 7400)
- Model-inferred suggestions based on description/payee
- A hybrid (rules first, model fills gaps)

**DocuClipper's approach (now observed directly):** Automated keyword rules fire on description text ("OFFICE RENT" → Rent, "TRANSFER" → Transfer, "QUICKBOOKS" → Software). Standard patterns are auto-categorised; anything non-standard shows as "Uncategorized." UK users can upload a Vendor Categorisation CSV to map custom payees. Rules must be manually triggered — not automatic on upload. This pattern works for common transactions but leaves the long tail blank, and the categories are US GAAP not UK nominal codes.

**What this tells us:** Keyword rules are the proven base layer. The open question is whether our model can fill the gaps that DocuClipper's rules miss — and whether we ship UK nominal codes (7xxx series) pre-mapped rather than making each practice define them from scratch.

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
