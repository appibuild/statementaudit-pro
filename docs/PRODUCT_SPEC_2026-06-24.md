# StatementAudit Pro — Product Specification
**Version:** 1.0 — 2026-06-24
**Prepared by:** Stephen Morris, C.S.M. Morris & Co.
**Purpose:** Board presentation — product review, competitive comparison, value case, and adoption rationale
**Status:** MVP complete. Beta-ready pending compliance gate (see Section 8).

---

## Executive Summary

StatementAudit Pro is a browser-based bank statement processing tool built specifically for UK and Channel Islands bookkeepers and accounting practices. It converts any bank statement PDF into a reviewed, reconciled, QBO/Xero-ready CSV — with a mandatory human approval gate at every step.

The product addresses a specific, proven pain point: clients who do not maintain real-time bookkeeping require catch-up processing of physical or PDF statements. No mainstream accounting software solves this. The available tools are US-centric, store client financial data on foreign servers, and struggle with UK and Channel Islands bank statement formats.

StatementAudit Pro is production-deployed, tested against real statements, and has been verified to import successfully into QuickBooks Online.

---

## 1. The Problem

### 1.1 Who has this problem

- Bookkeepers and accounting practices handling catch-up or rescue bookkeeping clients
- Any client who did not enter transactions as they went — restaurants, sole traders, landlords, small businesses
- Practices in Jersey and the Channel Islands where direct bank feeds either do not exist or are unreliable (HSBC CI, NatWest CI, Lloyds CI and others do not provide QBO/Xero feeds)
- Higher-compliance clients (law firms, estate agents, charities, regulated businesses) where cloud-storage of client financial data creates a regulatory obstacle

### 1.2 The current workflow (without StatementAudit Pro)

1. Bookkeeper receives PDF bank statement from client
2. Bookkeeper manually re-types each transaction into QBO/Xero — or uses a third-party tool that stores the data externally
3. Bookkeeper manually assigns nominal codes or categories to each transaction
4. No automatic reconciliation check — errors are discovered late (or not at all)
5. Time cost: 2–4 hours per statement depending on volume; zero scalability

### 1.3 Why this matters for Channel Islands practices specifically

- Channel Islands banks (HSBC CI, NatWest CI, Lloyds CI, RBS, Co-op) have limited or no direct feed capability with QBO/Xero
- Jersey has no VAT/MTD requirement, so the MTD-driven adoption path that UK firms relied on does not apply — catch-up remains a larger share of the workload
- US-hosted tools create a data residency issue under the Jersey Data Protection (Jersey) Law 2018 (DPL 2018) that a Jersey practice cannot ignore
- Stephen Morris, the product's creator, has operated in the Jersey bookkeeping market since 1999 and built this tool from direct knowledge of the bottleneck

---

## 2. What the Product Does

### 2.1 Core pipeline (step by step)

```
PDF Upload → AI Extraction → Deterministic Reconciliation → Human Review → Human Approval → CSV Export → QBO/Xero Import
```

Each stage is described below.

**Step 1 — Upload**
Bookkeeper uploads a bank statement PDF (any UK or CI bank; any layout). File is sent over HTTPS to a Frankfurt-hosted proxy; AI extracts transaction data. No file is stored at any point.

**Step 2 — AI Extraction**
AI converts the statement to structured JSON: date, description, payee, debit/credit, running balance per row. Works on multi-page statements, combined accounts, and non-standard layouts including CI bank formats that trip US tools.

**Step 3 — Deterministic Reconciliation**
Code (not AI) verifies: opening balance + all debits − all credits = closing balance. Any discrepancy is flagged immediately with a red banner showing the exact amount missing. This is the integrity check — it catches dropped rows, OCR errors, and any extraction failure before the bookkeeper wastes time reviewing.

**Step 4 — Human Review**
Bookkeeper reviews each transaction. Recognised payees are auto-filled from memory with a purple pin badge. Unknown payees hold a temporary code (Misc Expense / Misc Revenue) highlighted in amber. Bookkeeper assigns codes, can toggle whether each payee is remembered for next time, and can re-run extraction if needed.

**Step 5 — Human Approval (mandatory gate)**
The bookkeeper must click Approve for each statement. This is the only path to a CSV. There is no auto-approve, no bulk approve without review, and no way to bypass this gate. The approval event also writes any new payee→code mappings to memory.

**Step 6 — CSV Export**
UTF-8 BOM CSV in the exact column format required by QBO/Xero import. Dates in DD/MM/YYYY. Multiple approved statements can be merged into a single CSV in one click.

**Step 7 — QBO/Xero Import**
Bookkeeper imports the CSV directly into QuickBooks Online or Xero. Transactions arrive pre-coded where memory already recognised the payee — reducing in-app editing to only genuinely new or ambiguous items.

### 2.2 Payee Code Memory (the differentiating feature)

- Every approved payee→code mapping is stored in browser localStorage — persists across sessions on the same machine
- On next statement: recognised payees auto-fill instantly, before the bookkeeper sees them
- On Approve: new mappings are written automatically; a JSON backup downloads to the bookkeeper's machine silently
- Rules can be exported to a named file and imported on another machine — enabling per-client rule sets filed with client records, firm templates, and staff handover
- QBO bank rules (exported as .xls from QBO) can be imported to pre-populate the memory — so an existing QBO rule library immediately seeds the tool

### 2.3 What the tool does NOT do

- Does not write anything back to QBO/Xero directly (no OAuth, no API write access)
- Does not store any personal data server-side at any point
- Does not make any financial decisions — all arithmetic is deterministic code; AI only transcribes
- Does not auto-approve or bypass human review
- Does not give financial advice

---

## 3. Technical Architecture

```
[Bookkeeper's browser]
    ↕ HTTPS/TLS
[Render proxy — Frankfurt, EU] (transient; no storage)
    ↕ HTTPS/TLS
[Anthropic API — US] (transient; no training on API data)
    ↕ JSON response
[Bookkeeper's browser] → CSV download → QBO/Xero
```

| Property | Status |
|---|---|
| Server-side storage of personal data | None — by architectural design |
| Data in transit | HTTPS/TLS on all legs |
| Proxy location | Frankfurt, EU (Render, ISO 27001 certified) |
| AI processing location | Anthropic API, US (SCCs + UK IDTA in DPA) |
| User accounts / database | None |
| Browser data retention | Session only — cleared on tab close |
| Payee rules | Browser localStorage, client's own machine |
| API key exposure | Server-side only; never reaches browser |

---

## 4. Competitive Landscape

### 4.1 Comparison table

| | StatementAudit Pro | DocuClipper | Datamolino | Manual re-entry | QBO/Xero bank rules |
|---|---|---|---|---|---|
| **Designed for UK/CI formats** | Yes (CI-native) | US-first (known format issues) | EU/UK (generic) | N/A | N/A |
| **Data stored server-side** | No | Yes (US servers) | Yes (EU servers) | N/A | Yes (QBO/Xero cloud) |
| **Jersey DPL 2018 compliant posture** | Yes | Unclear / risk | Possible | N/A | Possible |
| **Reconciliation check** | Yes (deterministic) | Yes | Yes | Manual | No |
| **Human approval gate** | Mandatory | Optional | Optional | Inherent | No |
| **Payee code memory** | Yes (upstream, pre-import) | No | No | No | Partial (in-app only) |
| **Works without bank feed** | Yes | Yes | Yes | Yes | No (requires feed) |
| **Catch-up / rescue bookkeeping** | Primary use case | Supported | Supported | Slow | Not applicable |
| **Billing reputation** | Clean (new product) | Poor (auto-renewal complaints, 1.5 Trustpilot) | Mixed | N/A | Bundled with QBO/Xero |
| **Pricing model** | TBC / per practice | $39–$149/month USD | €49+/month | Time cost | Bundled |
| **Data sent to AI** | Yes (Anthropic, US, SCCs) | Yes (US, storage) | Yes (EU) | No | No |
| **Product rating** | Beta | ~4.7 G2 | 3.8 G2 | N/A | N/A |

### 4.2 DocuClipper — detailed notes

DocuClipper is the primary incumbent in this space. It is a well-built product (~4.7/5 on G2) with genuine extraction capability and reconciliation. Its weaknesses relevant to this market:

- **Billing and cancellation reputation:** 1.5/5 on Trustpilot. Complaints centre on auto-renewal without notice and difficult cancellation. This creates a trust problem — and a switching opportunity.
- **US-centric extraction:** DocuClipper's own help documentation acknowledges known issues with non-US bank statement layouts: "debits and credits reversed" and "dates rendered as NaN" on certain UK/European formats.
- **Data residency:** Customer data is processed and stored on US servers. For a Jersey practice under DPL 2018, this creates a transfer risk that requires documented safeguards. Many smaller practices are unaware of this exposure.
- **No upstream coding memory:** DocuClipper extracts and reconciles but does not carry payee→code mappings forward. Coding still happens in QBO/Xero, statement by statement.
- **Marketing posture:** DocuClipper runs an SEO page arguing that "raw AI tools like Claude" hallucinate and drop rows, positioning this as a compliance risk. This matters — it means the incumbent is actively pushing a narrative against AI-powered tools. Our counter-narrative is the architecture: AI transcribes, code verifies, human approves.

### 4.3 Datamolino

- EU-hosted, stronger GDPR posture than DocuClipper
- Broader document type support (invoices, receipts, not just statements)
- More expensive for statement-heavy practices
- No particular Channel Islands calibration
- No payee code memory

### 4.4 QBO/Xero built-in bank rules

- Only work on live bank feeds — irrelevant for catch-up or where CI banks do not feed
- Rules fire post-import, not pre-import: coding happens inside QBO/Xero, not upstream
- No extraction from PDF; no reconciliation on import
- No portable rule sets; rules are locked to the QBO/Xero organisation

### 4.5 Manual re-entry

Still common in smaller practices and for CI banks with no feed. Time cost: 2–4 hours per statement at a minimum. For a bookkeeper charging £35–£50/hour, a single catch-up statement costs the client £70–£200 in labour. A practice processing 10 statements per week is spending 20–40 hours/month on transcription alone.

---

## 5. Value Proposition

### 5.1 Time saving

For a bookkeeper who handles catch-up statements regularly:

| Activity | Without tool | With StatementAudit Pro |
|---|---|---|
| Per-statement transcription | 60–120 minutes | 2–5 minutes (AI extraction) |
| Reconciliation check | Manual (often skipped) | Automatic on extraction |
| Nominal code assignment (known payees) | Full review every time | Auto-filled from memory |
| Nominal code assignment (new payees) | Same as always | Same as always |
| QBO/Xero import | Same | Same (CSV prepared) |
| **Total per statement** | **90–150 min** | **10–20 min** |

Conservative estimate: 80% time reduction on the transcription and review workload for recurring clients where memory has populated. New clients show lower savings until memory builds across the first 1–2 statements.

### 5.2 Accuracy

- Deterministic reconciliation catches dropped rows and arithmetic errors at extraction — before the bookkeeper wastes time reviewing a corrupted statement
- Human approval gate means every transaction is seen by a qualified person before it leaves the tool
- No AI hallucination of final numbers: AI transcribes text; code does all arithmetic

### 5.3 Compliance posture

This is the differentiating factor for regulated or compliance-aware practices:

- No client financial data stored server-side — the claim is architecturally true, not a policy promise
- Frankfurt EEA proxy means the European leg of transit stays within the EEA
- Anthropic US transfer governed by SCCs and UK IDTA — documented in the product's compliance assessment (prepared by the product's compliance officer, Stephen Morris, ICA Advanced Certificate in Compliance)
- For a practice that handles law firm client accounts, estate agent client money, charity funds, or regulated trust assets — this posture may be the deciding purchase criterion that no US-hosted tool can match

### 5.4 Channel Islands specificity

- CI bank formats (HSBC CI, NatWest CI, Lloyds CI) tested and working
- Jersey DPL 2018 aligned posture — product is operated by a Jersey-based business, registered or registering with JOIC
- No MTD complication — product is statement processing only; does not interfere with Jersey's separate tax framework
- Local support and understanding of the CI bookkeeping market

---

## 6. Target Market

### 6.1 Primary — Channel Islands bookkeepers and accounting practices

Small practices (1–10 staff) handling a mix of local businesses, sole traders, and landlords. These practices are the most underserved: CI banks have the fewest feeds, CI clients the most catch-up work, and US tools the most format failures.

**Estimated addressable pool (Jersey only):** approximately 200–400 registered bookkeepers and accountants in active practice. Not all handle statement catch-up but a significant majority will encounter it.

### 6.2 Secondary — UK catch-up and rescue bookkeeping specialists

UK-based bookkeepers who handle catch-up clients — existing and new engagements where no bank feed was set up. UK also presents the compliance angle: regulated practices, law firms, charities, and estate agents where data residency is a hard requirement.

### 6.3 Premium self-select — compliance-sensitive practices

Any practice whose clients are regulated entities. The no-storage posture is a premium feature here — these clients will pay more for a tool that can survive a compliance review. The target is not to build features for this segment but to let them self-select through the product's existing architecture.

---

## 7. Pricing Model (Proposed)

The product is pre-revenue. Pricing has not been finalised. The following is a framework for board consideration:

| Tier | Description | Indicative monthly price |
|---|---|---|
| **Solo** | 1 user, up to 20 statements/month | £19–£29/month |
| **Practice** | Up to 5 users, up to 100 statements/month | £49–£79/month |
| **Firm** | Unlimited users, unlimited statements | £99–£149/month |

Comparable tools (DocuClipper at $39–$149/month, Datamolino at €49+/month) validate that practices will pay in this range. Sterling pricing, honourable cancellation terms, and CI-native positioning are the commercial differentiators.

**Note:** These are indicative ranges only. Pricing should be set after beta feedback confirms willingness-to-pay from real users.

---

## 8. Current Status

### 8.1 What is built and verified

- PDF upload and AI extraction (live on Render, Frankfurt)
- Deterministic reconciliation with balance-break detection
- Human review interface with per-transaction editing
- Mandatory approval gate
- Payee code memory (Layer 1 — localStorage, across sessions)
- Auto-backup of payee rules on every Approve
- Export: JSON backup, save-to-location, import from JSON, import from QBO .xls
- Merged multi-statement CSV export (UTF-8 BOM, DD/MM/YYYY, QBO/Xero format)
- QBO import verified: 60 transactions imported successfully in testing
- Upload-screen data handling notice
- Compliance assessment prepared (ICA Advanced Certificate holder)
- Live deployment: Render (Frankfurt), accessible via browser, no install required

### 8.2 What remains before first external customer

| Item | Owner | Effort |
|---|---|---|
| JOIC registration (jerseyoic.org, ~£70) | Stephen | 30 minutes |
| Execute Render DPA (render.com/dpa) | Stephen | 15 minutes |
| Verify Anthropic DPF status (dataprivacyframework.gov) | Stephen | 10 minutes |
| Conduct and document Transfer Risk Assessment (Anthropic US) | Stephen (ICA Advanced Certificate) | 2–3 hours |
| Draft customer Data Processing Agreement | Stephen (ICA Advanced Certificate) | 2–4 hours |
| Write and publish Privacy Policy | Stephen | 2–3 hours |
| Document Record of Processing Activities | Stephen | 1 hour |
| Establish breach notification procedure | Stephen | 1 hour |

### 8.3 What is deferred (not required for beta)

| Item | Trigger |
|---|---|
| Layer 2 payee suggestion (AI-assisted coding for new payees) | Real beta user confirms new-client unfamiliarity is the actual bottleneck |
| QBO/Xero API read (pull chart of accounts) | High value but not blocking — deferred until first customer confirms need |
| Rate limiting on proxy endpoint | Before meaningful public traffic |
| CORS restriction on proxy | Before meaningful public traffic |
| User guide / onboarding documentation | Before public launch |

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI extraction error on unusual format | Medium | Low (caught by reconciliation + human gate) | Re-run button available; deterministic check catches all arithmetic failures |
| Anthropic API cost at scale | Medium | Medium | Pinned model; 32k token cap; cost per statement currently under £0.10 |
| DocuClipper competitive response | Low | Low (they target US/enterprise) | CI-native + no-storage posture not replicable without architectural rebuild |
| Jersey DPL non-compliance before JOIC registration | High (if ignored) | High (criminal offence) | Register before any external customer — straightforward self-serve registration |
| Render outage / deployment issue | Low | Medium (users cannot process statements during outage) | Manual re-deploy available; no data at risk |
| Browser localStorage loss (user clears cache) | Medium | Low (backup downloads automatically on every Approve) | User guide should emphasise backup file importance |
| Pricing set too low to sustain costs | Low | Medium | Anthropic API + Render costs are sub-£50/month at low scale; pricing headroom is wide |

---

## 10. Reasons for Adoption — Summary

A Jersey or UK bookkeeping practice should adopt StatementAudit Pro when:

1. **Bank feeds are unavailable.** Channel Islands banks and some UK banks do not provide QBO/Xero feeds. Without a feed, catch-up is manual — and this tool eliminates 80% of that manual work.

2. **Catch-up volume is significant.** Any practice that regularly handles clients who did not enter as they went — restaurants, landlords, sole traders — will recover the subscription cost in hours within the first month.

3. **Compliance exposure matters.** The tool's no-storage architecture means client financial data is never persisted outside the client's own browser. For practices handling regulated client money, this posture is not a nicety — it may be a regulatory requirement.

4. **The team is doing the same coding work repeatedly.** The payee code memory compounds — as each statement is processed, the tool gets faster. By month 3 on a regular client, most transactions arrive pre-coded and the bookkeeper is reviewing exceptions, not re-coding known payees.

5. **DocuClipper or similar is failing on your formats.** If a practice is already paying for a US tool and getting reversed debits, NaN dates, or reconciliation gaps on CI bank statements — there is an immediate, verifiable case to switch.

---

## 11. Board Questions — Anticipated

**Q: Is the AI making financial decisions?**
No. The AI transcribes text from the PDF to structured data. All arithmetic (reconciliation, totals, balance checks) is deterministic code. No AI inference touches any number.

**Q: What happens if the AI drops a transaction?**
The deterministic reconciliation check will immediately flag a balance discrepancy. The bookkeeper sees the exact amount missing and can re-run extraction or manually add the gap transaction. This is the primary quality control.

**Q: Who can see the client's bank data?**
The bookkeeper who uploads it, via their browser. The data passes transiently through Render's Frankfurt server (ISO 27001 certified) and Anthropic's US API. Neither retains a copy. No other party has access.

**Q: What stops someone else accessing past statements?**
Nothing is stored server-side. Once the browser tab is closed, all statement data is gone. There is no user account system, no stored history.

**Q: What is the exit strategy if the product is shut down?**
The CSV export is a standard format accepted by QBO/Xero directly. Payee rules export as a portable JSON file. There is no proprietary lock-in — clients can stop using the tool at any time with no data trapped.

**Q: Is this a long-term viable business or a personal tool?**
It is currently a personal tool in beta. The commercial question is whether Jersey and UK bookkeepers will pay for it at a volume that sustains costs and generates meaningful revenue. The beta phase is designed to answer that question with real signal rather than estimates.

---

*Prepared for board review. This document does not constitute a business plan or financial projection. Figures marked "indicative" are illustrative ranges pending market validation.*
