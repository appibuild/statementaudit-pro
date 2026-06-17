# StatementAudit Pro — Rebuild Brief (for an OpenAI-model build)

**Prepared:** 17 June 2026 · **Source of truth:** `01_LIVE_CODE/statement-audit-pro.jsx` (1,524 lines, live artifact)

This is the orientation document. Read it first, then the live `.jsx`, then the docs in `02_PROJECT_DOCS/`. **Where this brief and the live code disagree, the live code wins** — it has drifted ahead of the written docs before.

---

## 1. What the app is

A UK/Jersey bookkeeping tool that turns bank-statement PDFs into clean, reconciled, accounting-ready CSV for QuickBooks Online and Xero. The pipeline is the product, not the extractor:

**Upload PDF → AI extracts transactions as JSON → deterministic reconciliation → human reviews & edits → human approves (mandatory gate) → CSV export → user imports to QBO/Xero.**

Supports up to 20 PDFs per batch, four account types (Current, Savings, Credit Card, Loan/Mortgage), per-file platform choice.

## 2. Current framework

- **Single React component** (JSX), inline styles only, a colour-constant object `C`. No Tailwind/CSS files.
- Fonts Inter + JetBrains Mono injected via `useEffect` + Google Fonts.
- Runs today as a **Claude.ai artifact**, so API auth is handled by the host — **there is no backend and no `.env` in the current build.** That is exactly the limitation the rebuild should remove.
- API call is a plain `fetch` to `https://api.anthropic.com/v1/messages` (see line ~387 of the jsx).

## 3. The rebuild target (what you're being asked to produce)

A standalone app where **the user controls the infrastructure** (privacy is a core selling point). Suggested shape:

- **Frontend:** React (Vite) — the existing component is a near-complete UI; port it largely as-is.
- **Backend:** Node/Express proxy that holds the OpenAI API key server-side and forwards extraction requests. **No model key in client code, ever.**
- **`.env.example`:** `OPENAI_API_KEY=`, `PORT=3001`, `OPENAI_MODEL=` (pin a vision-capable model that accepts PDF/image input).
- **Storage:** default to **none** (stateless, in-memory per session) to keep the privacy claim honest. Any persistence is opt-in and documented.

## 4. NON-NEGOTIABLES (these define the product — do not drop them)

1. **Mandatory human approval gate.** The Approve button is the ONLY path to CSV. No auto-approve, no bulk approve without review. This is the headline differentiator.
2. **Reconciliation is always visible before approval.** Never hide/collapse the 7-figure strip.
3. **Don't let the model do the arithmetic.** The model transcribes (transactions + the printed running-balance column). **Deterministic code** computes totals, reconciliation, and derives/cross-checks the opening balance. This is in `recalc()` (jsx line ~119) and must be reproduced exactly.
4. **Two reconciliation polarities:**
   - Current / Savings (credit-positive): `calculatedClosing = opening + credits − debits`
   - Credit Card / Loan (debit-positive): `calculatedClosing = opening + debits − credits`
5. **Foreign transactions:** never drop lines containing "@" or "Visa Rate". Classify as VIS, keep the GBP amount.
6. **Financial precision:** 2 dp, `+parseFloat(n).toFixed(2)`; never raw float arithmetic committed to currency fields.
7. **Dates DD/MM/YYYY** in display, prompts and CSV body. File names use YYYY-MM-DD.
8. **CSV UTF-8 BOM:** prepend `\uFEFF`.
9. **Robust JSON extraction:** slice from first `{` to last `}` then `JSON.parse`. Never trust a raw parse; never use assistant-prefill.

## 5. The extraction prompts (port these — they encode hard-won bank quirks)

The full prompts are in the jsx (`BASE_PROMPT` + `PROMPTS` object, lines ~40–102). Carry them over **verbatim** as the system prompt content, adapting only the API envelope. Key rules they encode:

- Strict JSON-only output, given schema.
- Strip payment-type prefixes from descriptions.
- Rebuild wrapped multi-line transactions; set `wrapped:true`.
- Set `ambiguous:true` when unsure (drives a review badge) — never guess silently.
- Transcribe the printed running `balance` per row EXACTLY, signed, or null if not printed. **Do not calculate it.**
- Opening/closing balances: return as printed; the app cross-checks and corrects. Some banks (Lloyds) print a "Balance on [start date]" that already includes day-one's first transaction — so the printed opening is NOT the true brought-forward figure. This is handled in deterministic code (the running-balance two-anchor method), already resolved — see §7. The prompt's only balance job is to transcribe the printed running-balance column exactly and read the summary markers as printed.
- Overdrawn markers ("D"/"DR"/"OD") → negative; "CR"/"C" → context-dependent (negative on a credit card = overpaid).

## 6. OpenAI migration notes

- **Input:** OpenAI vision-capable chat models accept PDF/image input. Send the statement as a base64 file/image part plus the system+user prompt. The current code converts files to base64 already (`toBase64`, jsx ~107).
- **JSON:** prefer the structured/JSON response mode where available, but **still run the robust `{`…`}` slice extractor** as a backstop — never rely solely on the model returning clean JSON.
- **Token budget:** the Anthropic build uses `max_tokens: 32000` to handle ~137-transaction statements. Match or exceed the equivalent output cap; if a real statement truncates, chunk by page rather than lowering fidelity.
- **Rate limits:** keep the existing friendly "usage limit reached — wait and run again" handling and the short pause between sequential calls.
- **A/B everything against ground truth.** There is an accuracy test plan referenced in the docs (synthetic statements with known totals). Do not declare the OpenAI extractor "good" on vibes — measure transaction count, debit/credit totals, reconciliation rate, and manual-corrections-needed against the known answers.

## 7. Solved correctness work (do NOT re-solve) and the one genuinely open item

**Already resolved and live-verified — inherit these, do not rebuild them from scratch:**

- **Lloyds opening balance — RESOLVED (06-16).** Lloyds prints an opening figure that already includes day-one's first credit, so naïve reconciliation showed a ~£100 variance. Fixed by the **running-balance two-anchor method**: the model transcribes the printed running-balance column (a reading task it does reliably); deterministic code then derives the true opening two independent ways — top-down (first printed balance − the movement up to it) and bottom-up (closing − net) — and auto-applies it on load when both anchors agree. If they disagree, it flags rather than silently committing. See `trueOpeningFromTop`, `openingAnchorsAgree`, `balanceBreaks`, `integrityChecked` in the jsx `recalc`. **This is the most important architectural pattern to carry across, not an open bug.**
- **HSBC missing-transaction class — RESOLVED (06-16, detection).** The per-row integrity check walks consecutive printed balances and flags any span the transactions don't account for (a dropped or mis-entered row).
- **CR / credit-balance opening — RESOLVED (06-17).** On credit-card and loan accounts (debit-positive), a balance carrying a credit marker ("CR"/"C"/trailing minus) means the holder is overpaid and must be returned NEGATIVE. Fixed with an **account-type-aware** prompt rule (a blanket CR→negative rule would corrupt current accounts, where CR = in credit = positive). Carry the per-account-type marker rules across verbatim.

**The one genuinely open build item: duplicate-detection tuning (item 4).** The detector currently fires loud red row-level flags for three situations that should be treated differently: (1) a whole statement loaded twice — should be one statement-level warning, ideally caught at upload, not a sea of red rows; (2) a legitimate same-day repeat within one statement (e.g. two identical car-parking charges that both reconcile) — should be a soft amber "verify", must NOT block the green tick; (3) a genuine partial cross-statement overlap (the Open Banking double-count) — keep the strong flag, this is the only case the loud treatment suits. Proposed logic: `findDupes` splits matches into same-statement vs cross-statement; `greenLit` blocks only on the cross-statement set. Smallest first cut (Jason Fried's lean): just soften scenario 2.

Avoid building a per-bank prompt library — use a small set of general rules per account type. The opening-balance and integrity work lives in deterministic code, not the prompt; the prompt's only balance job is to transcribe the printed column and read the summary markers as printed.

## 8. CSV output formats (reproduce exactly)

- **QuickBooks Online:** `Date,Payment Type,Description,Payee,Debit,Credit,Nominal Code,Notes` — Debit and Credit both positive, the unused field blank.
- **Xero:** `Date,Amount,Payee,Description,Reference,Cheque Number,Analysis Code` — Amount signed (negative = money out); Reference = payment type; Analysis Code = Nominal Code.
- **File name:** `BankName_YYYY-MM-DD_to_YYYY-MM-DD_PLATFORM.csv`. Transaction dates in the body stay DD/MM/YYYY.

## 9. Roadmap context (so you build extension points, not walls)

In rough order: duplicate-detection tuning (item 4, the current open item — see §7); stateless semantic categorisation (payee → nominal code, every code shown for human approval); bank rules / auto-categorisation (needs persistence — fine once you have a backend); .xlsx export + audit log; later, direct push to QBO/Xero via OAuth2 and multi-user.

---

## 10. The Board of Advisers (carry this team across)

Strategic decisions are evaluated against this standing panel before a single recommendation is made. They are organised in two tracks. Keep consulting them in the new build.

**Build / product track**
- **Amy Hoy** — problem definition & customer clarity; pricing. Guards against building for an imagined customer rather than the real non-developer bookkeeper.
- **Jason Fried** — scope discipline & simplicity. "Don't build a backend before there's something worth deploying; but once a feature needs persistence, the artifact is a dead end — move, no half-measures."
- **UK Practice Manager** (the customer persona) — a bookkeeper/practice manager at a small UK/Jersey firm processing client statements monthly into QBO or Xero. End-user validation.

**Marketing / growth track**
- **Angus Cheng** — content marketing & solo-SaaS growth. GTM needs a public, rankable URL — which standalone (not an artifact) provides.
- **David Ogilvy** — copy & conversion. The privacy claim ("your data is never stored") and the DocuClipper comparison are the strongest assets — but the privacy headline is only fully credible on infrastructure the owner controls.
- **Paul Jarvis** — solo-SaaS positioning. "Artifact = lab; standalone = product. A company-of-one needs something ownable, billable, durable." Simplicity as competitive advantage.

How to use them: before a strategic recommendation, reason through how each relevant adviser would weigh in, surface genuine disagreements (e.g. Fried's scope-cutting vs the unified-pipeline narrative), then give one opinionated recommendation. They are a device for stress-testing decisions, not a chorus that always agrees.

---

## 11. File guide for this bundle

- `01_LIVE_CODE/statement-audit-pro.jsx` — **the canonical build. Start here for behaviour.**
- `02_PROJECT_DOCS/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` — the full standing spec (features table, quality standards, architecture decisions).
- `02_PROJECT_DOCS/STATEMENTAUDIT_HANDOVER_2026-06-17.md` — latest session handover (most recent state).
- `02_PROJECT_DOCS/DECISION_RECORD_2026-06-12_*.md` — the artifact-vs-standalone decision with the board's reasoning.
- `02_PROJECT_DOCS/STATEMENTAUDITPRO_HANDOVER_FROM_UKBANKCONVERTER_2026-06-06.md` — market/positioning intelligence (DocuClipper, pricing, Angus Cheng benchmark).
- `03_DELIVERABLES/*.docx` — customer-facing Quick Start card and Practitioner's Playbook.

**No live API keys are included in this bundle.** The current build has none (the artifact host supplied auth); the rebuild introduces `OPENAI_API_KEY` server-side via `.env`.
