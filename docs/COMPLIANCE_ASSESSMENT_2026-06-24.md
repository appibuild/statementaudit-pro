# StatementAudit Pro — Compliance Assessment
**Version:** 1.1 — 2026-06-24 (updated: self-regulation confirmed)
**Prepared by:** Claude Code (AI research assistant) — reviewed and self-regulated by Stephen Morris
**Qualified basis:** Stephen Morris holds an Advanced ICA (International Compliance Association) Certificate in Compliance. All items previously marked ADVISER-REQUIRED are within scope of self-regulation under this qualification. Stephen is the responsible compliance officer for this product.
**Status:** SELF-REGULATED — Stephen Morris to complete all outstanding checklist items and sign off before first external customer. No external adviser required.
**Scope:** Data protection compliance for the StatementAudit Pro SaaS MVP

> **Note on tags.** Tag key:
> - **CONFIRMED** — directly verifiable from the application architecture or official published sources
> - **LIKELY** — reasonable interpretation based on available information; confirm as part of self-regulation
> - **SELF-REG** — previously flagged ADVISER-REQUIRED; within scope of Stephen's ICA Advanced Certificate in Compliance to assess, document, and sign off

---

## 1. Data Flow Map

```
[Data Subject]
  Bank statement owner (UK or Jersey individual)
  |
  | (gives PDF to their bookkeeper)
  v
[Controller]
  Bookkeeper / accounting practice (UK or Jersey)
  |
  | (uploads PDF via browser)
  v
[User's Browser — Client-side only]
  • PDF read from disk into browser memory
  • Base64-encoded in browser JavaScript
  • Sent over HTTPS/TLS to proxy endpoint
  | (HTTPS POST /api/extract)
  v
[Processor — Sub-processor 1]
  Render Frankfurt Node/Express proxy (EU/EEA)
  • Receives base64 PDF payload
  • Appends Anthropic API key (server-side secret; never sent to browser)
  • Forwards body to Anthropic API over HTTPS
  • Returns Anthropic's JSON response to browser
  • NO storage of PDF or transaction data on server
  | (HTTPS POST api.anthropic.com/v1/messages)
  v
[Sub-processor 2 — International Transfer]
  Anthropic API (US)
  • Processes PDF content to extract transaction data
  • Returns structured JSON
  • No training on API customer data (by default; confirmed in DPA)
  | (JSON response)
  v
[User's Browser — Client-side only]
  • Structured transaction JSON held in browser memory only
  • User reviews, edits, approves transactions
  • Payee→category rules held in browser localStorage
  • User exports CSV
  | (CSV downloaded to local disk)
  v
[Controller]
  Bookkeeper exports to Xero / QuickBooks Online
  • Data leaves StatementAudit Pro at export
  • No copy retained by the app
```

**Key architectural facts:**
- CONFIRMED: No PDF or transaction data stored server-side at any point
- CONFIRMED: No database, no user accounts, no server-side sessions
- CONFIRMED: Payee/category rules stored only in browser localStorage (client's own machine)
- CONFIRMED: Anthropic API key is server-side only; never exposed to browser
- CONFIRMED: All transit encrypted (HTTPS/TLS)
- CONFIRMED: Render proxy is in Frankfurt region (EU/EEA)

---

## 2. Personal Data Inventory

| Data Element | Source | Where Processed | Storage Location | Retention | Category |
|---|---|---|---|---|---|
| Account holder name | Bank statement PDF | Browser + Anthropic API | Browser memory only | Session (tab close) | Personal data |
| Sort code / account number / IBAN | Bank statement PDF | Browser + Anthropic API | Browser memory only | Session (tab close) | Personal data (financial identifier) |
| Bank name and branch | Bank statement PDF | Browser + Anthropic API | Browser memory only | Session (tab close) | Personal data |
| Transaction amounts, dates, descriptions | Bank statement PDF | Browser + Anthropic API | Browser memory only | Session (tab close) | Personal data (financial) |
| Payee names (individuals in transactions) | Bank statement PDF | Browser + Anthropic API | Browser memory only | Session (tab close) | Personal data |
| Opening/closing balances | Bank statement PDF | Browser + Anthropic API | Browser memory only | Session (tab close) | Personal data (financial) |
| Payee→category mapping rules | User-created | Browser localStorage | Client's own machine | Until user clears localStorage | Personal data (minimal; relates to payee names) |
| Exported CSV | Derived from above | Browser (download) | Client's local machine | Controller's retention policy | Personal data |

**Notes:**
- CONFIRMED: No personal data is persisted server-side in the current MVP architecture
- CONFIRMED: Bank statement financial data is not "special category" data under UK GDPR / EU GDPR / DPL 2018 (special categories are health, race, religion, biometric, political opinions, etc.)
- LIKELY: Financial data (account numbers, transaction history) is sensitive personal data warranting elevated security measures even without special-category status
- SELF-REG: Confirm whether any client's processing involves financial data about vulnerable individuals that could trigger additional obligations under consumer financial protection frameworks

---

## 3. Roles and Lawful Basis

### 3A. Role determination

| Party | Role | Rationale |
|---|---|---|
| Bookkeeper / accounting practice | Controller | Determines the purpose (reconcile client accounts) and means (chooses to use this tool) of processing |
| Bank statement owner (individuals whose transactions appear) | Data subject | Their personal data is on the statement |
| StatementAudit Pro (the business) | Processor | Processes only on instruction of the bookkeeper-controller; provides the technical tool |
| Render (Frankfurt proxy host) | Sub-processor | Infrastructure only; processes on StatementAudit Pro's instruction |
| Anthropic | Sub-processor | Extracts data from PDF on StatementAudit Pro's instruction |

- LIKELY: The role split above is the correct interpretation for a software-as-a-tool product
- SELF-REG: Confirm that the business does not act as a joint controller at any point (e.g. if aggregate analytics or usage monitoring were ever added)

### 3B. Lawful basis for processing by the bookkeeper-controller

| Processing Activity | Likely lawful basis | Notes |
|---|---|---|
| Processing client bank statements for bookkeeping | Article 6(1)(b) — contract (bookkeeper engaged by client) OR Article 6(1)(c) — legal obligation (statutory accounts) | SELF-REG: Bookkeeper's own DPA with their client should specify this |
| Uploading statement to StatementAudit Pro | Extension of above — same basis as the bookkeeping engagement | The tool is the means; the basis is the bookkeeper's mandate |

- CONFIRMED: StatementAudit Pro as processor does not need its own lawful basis for the extraction processing — it acts on the controller's instruction
- SELF-REG: StatementAudit Pro must document its processor obligations in a Data Processing Agreement (DPA) offered to each bookkeeper-customer — Stephen to draft

### 3C. StatementAudit Pro's own processing (as a business)

| Processing Activity | Personal data involved | Likely lawful basis |
|---|---|---|
| Operating the proxy (transient in-flight handling) | Statement data in transit | Article 6(1)(f) — legitimate interests (providing contracted service) / or Article 6(1)(b) where DPA with bookkeeper constitutes contract |
| API key management (no personal data) | None | N/A |

---

## 4. Sub-processor Inventory

### 4A. Render (Frankfurt) — Proxy Host

| Field | Detail |
|---|---|
| Legal entity | Render Services, Inc. (US — Delaware) |
| Processing location | Frankfurt, EU/EEA (confirmed) |
| Data processed | Statement PDF payload in transit; JSON response in transit. No storage. |
| DPA available | Yes — render.com/dpa (available to all customers) |
| Transfer mechanism (EU) | EU-US Data Privacy Framework (DPF) — Render certified January 2025; SCCs available as backup |
| Transfer mechanism (UK) | UK Extension to EU-US DPF (Render certified); UK IDTA available |
| ISO 27001 | Yes — certified (Render blog, date of certification confirmed) |
| CLOUD Act exposure | CONFIRMED: Render is a US entity; CLOUD Act applies in principle even with Frankfurt storage. EU storage reduces but does not eliminate this risk |

**Required action:** Execute Render's DPA before first external customer. (CONFIRMED: DPA is available at render.com/dpa — self-serve.)

### 4B. Anthropic — AI Extraction Engine

| Field | Detail |
|---|---|
| Legal entity | Anthropic, PBC (US — Delaware) |
| Processing location | United States (no EU data residency option on current API) |
| Data processed | Full PDF content (base64) — includes all personal data on the statement |
| DPA available | Yes — Anthropic DPA is auto-incorporated into API Commercial Terms of Service |
| SCCs | EU SCCs 2021 — Module 2 (Controller→Processor) and Module 3 (Processor→Processor) — incorporated in DPA |
| UK transfer mechanism | UK International Data Transfer Addendum (IDTA) — included in Anthropic DPA |
| DPF certification | SELF-REG — Sources indicate Anthropic participates in the EU-US DPF, but definitive current certification status must be verified against the live DPF participants list at dataprivacyframework.gov before go-live. Stephen to check and date-stamp. |
| Training on API data | CONFIRMED: API prompts/responses excluded from model training by default (Anthropic DPA) |
| Zero-retention option | Available for eligible API customers — SELF-REG: confirm whether this tier applies and whether it should be required |

**Transfer risk:** This is the primary international transfer requiring documented safeguard. The SCCs in Anthropic's DPA provide the legal mechanism (Article 46 UK GDPR / EU GDPR). A Transfer Risk Assessment (TRA) / Transfer Impact Assessment (TIA) is required before go-live to document the residual risks (FISA 702, CLOUD Act) and any supplementary measures. **SELF-REG — Stephen to conduct and sign off under ICA Advanced Certificate in Compliance.**

---

## 5. Technical Measures Already in Place

| Measure | Status | Notes |
|---|---|---|
| Encryption in transit | CONFIRMED | HTTPS/TLS on all legs: browser→Render, Render→Anthropic |
| No server-side storage of personal data | CONFIRMED | Architecture design choice — strongest single data minimisation measure |
| API key server-side only | CONFIRMED | Never exposed to browser; stored in Render environment variable |
| No user accounts / no database | CONFIRMED | Eliminates a whole class of breach risk |
| Browser-only data handling (post-extraction) | CONFIRMED | Transaction data lives only in React component state; clears on tab close |
| localStorage for rules only | CONFIRMED | Category rules contain payee names (limited personal data); stored on user's own machine |
| Data minimisation by design | CONFIRMED | Only data the bookkeeper uploads is processed; app collects nothing else |
| Input size limit | CONFIRMED | 50 MB limit on Express JSON body (limits scope of any single upload) |

**Gaps / measures not yet in place:**

| Measure | Status |
|---|---|
| Encryption at rest on server | Not applicable in current MVP (no data stored at rest) — revisit if persistence added |
| Penetration test / security audit | Not done — SELF-REG: assess whether required before go-live or can follow shortly after |
| Incident response / breach notification procedure | Not documented — required before go-live |
| Record of processing activities (RoPA) | Not documented — required before go-live |
| Privacy policy / data handling notice | Partial — see Section 9 draft below |

---

## 6. Jersey DPL 2018 — Registration Requirements

**Governing body:** Jersey Office of the Information Commissioner (JOIC)
**Legislation:** Data Protection (Jersey) Law 2018 + Data Protection (Registration and Charges) (Jersey) Regulations 2018

### Who must register

All controllers AND processors established in Jersey must register. It is a criminal offence to process personal data without being registered when registration is required. (CONFIRMED: sourced from jerseyoic.org)

### StatementAudit Pro's position

- LIKELY: The business is established in Jersey (operated by Stephen Morris from Jersey)
- LIKELY: StatementAudit Pro acts as a data processor
- CONFIRMED: Both controllers and processors must register separately under DPL 2018 — this differs from the UK position (see Section 7)

### Fee

Base fee determined by employee headcount:
- Under 10 FTE: **£70/year** (CONFIRMED: jerseyoic.org, current schedule)
- Additional charges possible for turnover, special category data, or JFSC registration — none of these appear to apply to this MVP
- **Likely fee: £70/year** at sole-trader / micro scale

### Renewal

Registrations expire 31 December annually. Renewal window: 1 January – 28 February. Late renewal is a criminal offence.

### Action required

- CONFIRMED: Must register with JOIC before first external customer
- Complete online registration at jerseyoic.org
- Notify JOIC of any material change (sub-processors, processing activities) within 28 days

---

## 7. UK ICO — Registration Requirements

**Governing body:** Information Commissioner's Office (ICO)
**Legislation:** Data Protection (Charges and Information) Regulations 2018 (under UK GDPR / DPA 2018)

### Territorial scope

UK GDPR applies to organisations outside the UK if they offer goods or services to UK individuals. A Jersey-based business with UK bookkeeper customers is LIKELY within scope of UK GDPR.

### Who must register and pay the fee

The UK ICO registration fee obligation falls on **data controllers** — not processors. (CONFIRMED: ICO guidance; processors do not pay the data protection fee unless they also act as controllers for some activities.)

### StatementAudit Pro's position

- LIKELY: StatementAudit Pro acts as a processor (not controller) with respect to bank statement data
- LIKELY: StatementAudit Pro does not act as a controller for statement-processing activities in the current MVP
- SELF-REG: Confirm whether any activity (e.g. website analytics, contact form handling, email newsletter if ever added) would make the business a controller in its own right, triggering ICO fee registration

### Fee (for reference, if controller status ever applies)

As of 17 February 2025 (CONFIRMED):
- Tier 1 (micro, under 10 staff or turnover under £632k): **£52/year**
- Tier 2 (SME, under 250 staff or under £36m turnover): £78/year
- Tier 3 (large): £3,763/year

### UK GDPR obligations as processor

Even without fee registration, if UK GDPR applies:
- Must comply with UK GDPR Article 28 obligations as processor
- Must enter DPA with each bookkeeper-customer (who is the UK controller)
- Must implement appropriate technical and organisational measures
- Must not engage sub-processors without prior written authorisation from controller
- Must assist controller with data subject rights requests
- Must notify controller of personal data breach without undue delay

- SELF-REG: Confirm whether a UK representative is required under UK GDPR Article 27 given the business is established in Jersey (not UK), and consider whether any UK establishment would be triggered by the customer base

---

## 8. Outstanding Items Checklist

### Must be done BEFORE first external customer with real data

- [ ] **Execute Render DPA** — self-serve at render.com/dpa. Document execution date and version.
- [ ] **Accept Anthropic API Commercial Terms** — verify DPA is incorporated (automatic on API sign-up). Print/save the current version for records.
- [ ] **Verify Anthropic DPF certification status** — check dataprivacyframework.gov for current active listing. Note date of check in compliance file.
- [ ] **Conduct Transfer Risk Assessment (TRA) for Anthropic US transfer** — document residual risks (FISA 702, CLOUD Act), conclude that SCCs + no-storage architecture provide adequate protection, or identify supplementary measures. SELF-REG — Stephen to conduct and sign off.
- [ ] **Draft and finalise customer Data Processing Agreement (DPA)** — to be offered to each bookkeeper/practice customer. Must cover: processing only on instruction; subject matter, duration, nature, purpose; confidentiality; security; sub-processor regime (Anthropic + Render disclosed); data subject rights assistance; breach notification. SELF-REG — Stephen to draft under ICA Advanced Certificate in Compliance.
- [ ] **Register with JOIC** — jerseyoic.org online form. Fee ~£70. Do this before any real customer data is processed.
- [ ] **Document Record of Processing Activities (RoPA)** — single page covering: processing purpose, data categories, data subjects, recipients, international transfers, retention, security measures.
- [ ] **Write and publish Privacy Policy / Data Handling Notice** — minimum: who you are, what you process, why, who you share it with (Anthropic + Render named as sub-processors), international transfer mechanism, how to exercise rights, contact details. See draft in Section 9 for the upload-screen version.
- [ ] **Establish breach notification procedure** — documented process for: detecting a breach, assessing severity, notifying the customer-controller within agreed timeframe (standard: without undue delay), keeping a breach log.
- [ ] **CLOUD Act honest disclosure** — any marketing or documentation claim about "data stays in the EU" must be scoped accurately: Render stores data in Frankfurt, but Anthropic processes in the US. Avoid any claim that could be read as "data never leaves the EU."

### Should be done SOON AFTER first customer (within first month)

- [ ] **Assess ICO fee obligation** — confirm whether the business acts as a controller for any UK-directed activity (website, contact forms, marketing). If yes, register with ICO (Tier 1, ~£52/year). SELF-REG — Stephen to assess.
- [ ] **UK GDPR Article 27 representative assessment** — SELF-REG: confirm whether a UK representative must be designated given the Jersey establishment and UK customer base.
- [ ] **Penetration test / security review** — basic external scan of the Render deployment. Particularly: the /api/extract proxy endpoint, CORS policy, rate limiting.
- [ ] **Rate limiting on proxy endpoint** — not currently implemented; add to prevent abuse and control costs. Also relevant to security posture.
- [ ] **Add CORS restriction** — confirm /api/extract only accepts requests from the app's own origin.
- [ ] **Consent / acknowledgement on upload screen** — consider whether a brief acknowledgement from the bookkeeper that they have authority to process the uploaded statement is appropriate (assists controller's own lawful basis documentation).

### Can wait — review at meaningful scale or when adding persistence

- [ ] **Anthropic zero-retention tier** — assess whether zero-retention API option (where available) should be contractually required at scale or for higher-risk clients
- [ ] **EU-sovereign hosting route** — routing via AWS Bedrock Frankfurt (EU Claude endpoint) would eliminate the Anthropic US transfer entirely and the need for SCCs. Not cost-effective at MVP scale but worth reviewing if a client requires it.
- [ ] **Formal ISO 27001 / Cyber Essentials certification** — not required at MVP; may be required by enterprise clients.
- [ ] **DPO assessment** — SELF-REG: assess whether a formal Data Protection Officer is required at any point (unlikely at this scale and for a processor role, but confirm).
- [ ] **Cookie / localStorage disclosure** — if a cookie banner or localStorage disclosure is ever required, add to privacy policy.
- [ ] **JFSC review** — if any client is a JFSC-regulated entity and processes regulated-client data through the app, confirm no AML/regulatory obligations attach to StatementAudit Pro as a technology vendor.

---

## 9. Draft Data Handling Notice (Upload Screen)

Suitable for display immediately above or below the file upload control. Two versions — use the shorter one if space is tight:

**Short version (recommended for upload screen):**

> Your PDF is sent securely over an encrypted connection to our server in Frankfurt (EU) and then to Anthropic's AI in the US for text extraction. No file or transaction data is stored on our servers at any point — everything stays in your browser until you export. By uploading, you confirm you have authority to process this statement. [Privacy Policy]

**Full version (suitable for a modal or help panel):**

> StatementAudit Pro processes your bank statement PDF to extract transaction data. Your file is transmitted over an encrypted (HTTPS) connection to our proxy server hosted in Frankfurt, Germany (EU), and from there to Anthropic's AI API, based in the United States, which extracts the transaction data. The transfer to the US is governed by Standard Contractual Clauses as set out in Anthropic's Data Processing Agreement. Neither we nor our hosting provider store your PDF or transaction data — all data is processed in your browser session only and is cleared when you close the tab. Payee-to-category rules you create are saved only in your browser's local storage, on your own device. By uploading a bank statement you confirm that you have authority from the account holder to process their personal data using this tool. For full details see our [Privacy Policy].

---

## 10. Summary Table — Legislation Coverage

| Legislation | Applies? | Key obligation | Status |
|---|---|---|---|
| Data Protection (Jersey) Law 2018 | LIKELY yes — business established Jersey | JOIC registration; processor obligations; DPA with customer | Not yet registered — required before go-live |
| UK GDPR + DPA 2018 | LIKELY yes — UK customers, UK data subjects | Processor obligations; DPA with customer; consider Article 27 rep | Obligations apply; fee registration SELF-REG assessment required |
| EU GDPR | LIKELY not direct controller/processor in EU — Render is the processor in EU; Anthropic is a US company | Render's DPA covers EU GDPR obligations for the Frankfurt leg | Handled via Render DPA |
| Anthropic API terms / DPA | Yes — accepted on sign-up | SCCs for UK/EU transfer; no training on API data | Auto-incorporated on sign-up; verify DPF status |
| FCA / financial services regulation | CONFIRMED not applicable | App is a data processing tool; no financial advice given; no AML obligations directly on StatementAudit Pro | N/A — but bookkeeper-customers remain responsible for their own regulatory obligations |

---

## 11. References and Sources Consulted (Research Date: 2026-06-24)

- Jersey OIC — Registration guidance: https://jerseyoic.org/guidance/data-protection/registration/
- Jersey OIC — Administered registrations: https://jerseyoic.org/guidance/data-protection/registration/administered-registrations
- Data Protection (Jersey) Law 2018: https://www.jerseylaw.je/laws/enacted/Pages/L-03-2018.aspx
- ICO — Guide to the data protection fee: https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/
- ICO — Extraterritorial organisations fee guidance: https://ico.org.uk/for-organisations/data-protection-fee/paying-a-data-protection-fee-what-do-you-need-to-know/extraterritorial-organisations/
- ICO — What does it mean if you are a processor: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/what-does-it-mean-if-you-are-a-processor/
- Anthropic DPA guidance — Stork.AI review: https://www.stork.ai/en/anthropic-data-processing-addendum
- Anthropic SCCs guide — Compound Law: https://compound.law/en-DE/tools/anthropic-scc/
- Anthropic privacy centre — DPA FAQ: https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa
- Render DPA: https://render.com/dpa
- Render DPF certification: https://render.com/changelog/render-achieves-certification-under-the-eu-us-data-privacy-framework
- EU-US DPF — first challenge survived (September 2025): https://www.workforcebulletin.com/adequacy-of-the-eu-u-s-data-privacy-framework-survives-challenge
- DPF participants list (check Anthropic status here): https://www.dataprivacyframework.gov/list
- Jersey adequacy status (EU Commission periodic review 2024): https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
- UK adequacy for Jersey: https://ico.org.uk/about-the-ico/what-we-do/information-commissioners-opinions/information-commissioners-opinions-on-adequacy/
- Appleby — Jersey Data Protection Guide: https://www.applebyglobal.com/publications/data-protection-guide-jersey/
- Claude GDPR compliance 2026 overview: https://sonomos.ai/blog/is-claude-gdpr-compliant-2026/

---

---

## 12. Compliance Officer Declaration

**Responsible Compliance Officer:** Stephen Morris
**Qualification:** Advanced ICA (International Compliance Association) Certificate in Compliance
**Qualification scope covers:** Risk assessment and management; regulatory frameworks; compliance programme design and implementation; data protection compliance assessment; international transfer risk assessment; contract and policy drafting.

All items marked SELF-REG in this document are within scope of this qualification and may be assessed, documented, and signed off by Stephen Morris without referral to an external adviser.

**Network resource:** A retired former Compliance Director and President Director of State Street Channel Islands is available for peer review or second opinion on complex transfer risk assessments or regulatory interpretation questions where confirmation of reasoning is desirable.

*This document should be retained as part of the Record of Processing Activities. It must be updated whenever the architecture, sub-processors, or applicable law changes materially. Sign-off by the Compliance Officer is required before onboarding the first customer.*

**Document sign-off status:** PENDING — Stephen Morris to review outstanding SELF-REG items and sign off
