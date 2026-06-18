# StatementAudit Pro — The Practitioner's Playbook

### Claude.ai Projects — Build + Marketing Edition
*Includes: Board of Advisers · Project Instructions · Inner Loops · Verification · Marketing Playbook*

> **Note (2026-06-18):** This Playbook is a methodology/onboarding guide. A few technical references have since been superseded (it predates the Confidence Threshold System being built, the running-balance and CR opening fixes, and the removal of assistant prefill — the verification table still mentions confirming prefill, which no longer exists; the robust JSON extractor is now the sole mechanism). The *methods* here (planning discipline, board, verification loops, inner loops) are all current and valuable. For live build status, defer to the latest dated handover in `docs/`.

---

## What Claude.ai Projects Actually Is

Claude.ai Projects is a persistent workspace where every conversation in a project shares the same standing instructions, uploaded files, and memory context. For StatementAudit Pro, this means your production build rules, competitive intelligence, handover documents, and board of advisers are available each session.

| Feature | How It Works |
|---|---|
| What persists | Project Instructions (your standing rules) + uploaded files + conversation memory |
| What does NOT persist | Individual conversation context — each new chat starts fresh, but with project context re-loaded |
| Project Instructions | Re-read at the start of every conversation — your always-on operating system |
| Handover documents | Uploaded to project source files — Claude retrieves the latest dated version |
| Board of Advisers | Defined once in Project Instructions — any conversation can summon any member |

> **Tip:** The single most important thing to understand: Project Instructions are re-read at the start of every conversation. The `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` file in your project source is the master — update it there, then paste the updated version into the Project Instructions field.

---

## Phase 1 — Project Instructions (Your Operating System)

*Write it once. It applies to every conversation automatically.*

Project Instructions is the project's permanent brain: who you are, what the project does, how Claude should behave, what it must never do, and standing technical rules.

> **Note:** Don't put standing rules in a chat message when they belong in Project Instructions. Chat messages only affect that conversation; Project Instructions affect every conversation in the project.

**Master template structure:** Project name · What This Project Produces · My Role/Context · Standing Rules (human gate mandatory, DD/MM/YYYY, UTF-8 BOM, production quality, flag problems early) · Output Format (exact schema, column order, file naming) · Verification (what to check before "complete") · Never Do (bypass the gate, auto-approve, raw float on currency) · Board of Advisers.

**Project Instructions Audit (run monthly):** ask Claude to identify rules no longer relevant, contradictions, missing rules from recurring patterns, and to propose a tightened version — showing changes before applying.

---

## Phase 2 — The Planning Discipline

*The most valuable 10 minutes of any session.*

Claude defaults to solving the problem it interprets, not necessarily the one you have. Where a wrong decision could break the approval gate or corrupt CSV output, 5–10 minutes aligning first saves hours.

**Session opening prompt:** before starting, have Claude confirm (1) what it understands you're asking for, (2) what the output will look like, (3) what's out of scope, (4) any assumptions — and not start until you confirm, asking one question at a time.

---

## Phase 3 — Your Board of Advisers

Two tracks run in parallel: **build development** (product roadmap) and **marketing development** (SEO, pricing, positioning). Summon the right members for the question; you don't need all six at once.

| Board Member | Expertise | Their Lens |
|---|---|---|
| Angus Cheng | Growth / Content Marketing | Proved this exact playbook — $42K/month via content alone. "Is this building compounding SEO traffic, or a distraction from the one channel that works?" |
| Amy Hoy | SaaS Pricing & Customers | Creator of 30x500. "Who specifically is the customer? What is their actual pain, and are we solving the right version of it?" |
| Jason Fried | Product Simplicity | Basecamp founder. "What can we cut? Are we adding complexity that slows the real job down?" |
| David Ogilvy | Copywriting / Conversion | "Does this speak to a real bookkeeper's real problem? The privacy differentiator needs to be front and centre." |
| Paul Jarvis | Solo SaaS / Positioning | Author of *Company of One*. "Is this the simplest version that delivers real value? Do we need it before ten paying customers?" |
| UK Practice Manager | The Customer | Bookkeeper/practice manager at a small Jersey/UK firm, 10–20 client statements a month. "Would I trust this? Does the gate make sense? Is the CSV right for my QBO setup?" |

**Build decisions — who to ask:** Confidence System → Fried; bank rules scope → Jarvis + Hoy; standalone architecture → Fried + Jarvis; new account type/CSV → Practice Manager; any change to the approval gate → all six (non-negotiable, needs consensus).

**Marketing decisions — who to ask:** weekly SEO topic → Cheng; pricing copy → Ogilvy + Hoy; community angle → Hoy; Guernsey GST 2028 → Cheng + Practice Manager; Jersey/CI niche → Practice Manager + Ogilvy.

**Ask the Board — universal prompt:** give each member their honest perspective in voice, the key risk they'd flag, and what they'd tell you to do; then a synthesis (majority view, where they disagree); end with a single recommended action. Be specific in the question.

---

## Phase 4 — The Verification Loop

*Never accept "it should work" — always ask for proof.*

**Standing instruction:** after any task, confirm (1) what you did, (2) how you verified it (specific check, not "it should work"), (3) assumptions made, (4) anything uncertain. No "complete" without this block.

| Task Type | How to Verify It |
|---|---|
| React component / feature | Describe the render path, state changes, edge cases; paste the relevant code block. |
| CSV / data output | Row count, sum of Debit column, sum of Credit column, spot-check 3 transactions by name and amount. |
| Reconciliation logic | Show CSV Debits total, CSV Credits total, Opening, Calculated Closing, Statement Closing, variance or match. |
| API integration change | Confirm the robust JSON extractor is intact; show the messages array. *(Original said "assistant prefill" — that is removed; the extractor is now the sole mechanism.)* |
| System prompt edit | Show before/after for the changed section; confirm the foreign-transaction rule is still present. |
| Written content (SEO) | Word count, target keyword in title and first paragraph, no section contradicts the brief. |
| Project Instructions edit | Show before/after; explain what changed and why; confirm no non-negotiables weakened. |
| Architecture / strategy | Summarise the reasoning chain — what was considered and rejected, and why this option. |

**Mid-conversation audit:** pause and check what was asked vs delivered (gaps?), shortcuts taken, anything introduced that wasn't agreed, and what's uncertain. Don't just say everything's fine.

---

## Phase 5 — Inner Loops (Systemise Recurring Work)

| Trigger | Track | What It Does |
|---|---|---|
| PDF Batch Upload | Build | Upload → set account type + platform → process all → audit dashboard → approve → export. No questions unless a file is unreadable. |
| Confidence Threshold Build | Build | Build/iterate the confidence scoring. Never removes the approval gate. |
| Pass 2 Feature Build | Build | Bank rules / Excel export / audit log — each scoped, production standard, with a verification block. |
| Weekly SEO Post | Marketing | [Bank]+[software]+UK keyword → headline → 600–900 word post → meta description → internal links. |
| Community Post | Marketing | Topic → angle for UK bookkeeper audience → draft ready to paste. |
| Ask the Board | Both | Route to relevant members → perspectives → synthesis → single action. |
| Session Handover | Both | Generate a dated handover at session end. Never overwrite. |
| Monthly Project Review | Both | Audit instructions, board relevance, inner-loop currency. Propose changes; review before applying. |

**Weekly SEO post structure:** opening (the bookkeeper's problem) → solution (step-by-step) → why it matters (time saved, errors avoided, QBO/Xero-ready) → privacy note ("your bank data is never stored") → CTA (free trial, no card). Keyword in H1, first paragraph, and meta description. Never generic; never US spelling; never omit the privacy claim.

---

## Phase 6 — Keeping the Project Healthy Long-Term

**Monthly review:** superseded rules, gaps that recur but aren't captured, unused board members, inner loops needing updates, recurring mistakes that should become rules. Propose a revised draft; approve before changes.

**Expand vs new project:** expand when it's the same product/audience/output (e.g. credit-card + current-account statements share schema and gate); start new when output format, audience, or instructions differ (CSV processor vs a Word-doc proposal generator).

> **Tip:** Name projects by output, not input — "Bank PDF → QBO/Xero CSV + Human Audit" beats "Bank Statements".

---

## Build Roadmap Reference

**Next to build (priority order):** *(see the latest handover for current status — several items below have moved)*
1. Confidence Threshold System — calcConfidence + ConfidenceBadge + ⚡ fast-track. Human gate unchanged. *(Now built.)*
2. Bank Rules / auto-categorisation — payee pattern → nominal code. Highest commercial value; needs standalone for persistence.
3. Excel export (.xlsx) — SheetJS; sheet 1 reconciliation summary, sheet 2 all transactions.
4. Audit log — every inline edit with timestamp and before/after; exports as a companion file.
5. Standalone deployment — Node/Express proxy; API key + OAuth2 for QBO/Xero.

**Non-negotiables — never touch:** human approval gate (only path to CSV); reconciliation strip always visible before approval; foreign transactions ("@"/"Visa Rate" never excluded, classify VIS, keep GBP); CSV UTF-8 BOM; DD/MM/YYYY; `+parseFloat(n).toFixed(2)` (never raw float on currency).

---

## Marketing Roadmap Reference

**Confirmed gap vs all competitors** (DocuClipper, Bank Statement Converter, ukstatementconverter.co.uk, CapyParse, BankScanPro, ConvertMyBankStatement): no product combines UK payment-type codes as a structured column, a clean Payee field, Payments In/Out reconciliation, a mandatory human audit gate, batch processing up to 20, and zero document storage.

**Pricing:** Solo £15/month (individual, up to 10 statements/month); Practice £35/month (unlimited, multiple clients); annual = 2 months free.

**SEO keyword formula:** [Bank Name] + [Action] + [Software] + UK. Examples: "Convert HSBC bank statement to QuickBooks CSV UK", "Barclays bank statement to Xero CSV", "Jersey bank statement to QuickBooks Online". One SEO post per week, one community post per week, maintained 12+ months. Slow growth in months 1–3 is normal — don't pivot.

**Guernsey GST 2028:** GST arrives by Q1 2028; thousands of businesses will need to migrate historical data quickly. Batch processing + audit workflow is a strong answer. Begin CI content marketing ahead of the timeline — no competitor is positioned here.

---

*Converted from `StatementAuditPro_Practitioners_Playbook.docx` to Markdown on 2026-06-18. The `.docx` original remains the printable/shareable version.*
