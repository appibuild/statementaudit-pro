# StatementAudit Pro — Handover 2026-06-29 (7 Competitive Features)

**Commit:** `ccf44ec` · **Lines:** 4799 · **verify.sh:** 13/13 green  
**Baseline:** Sits on top of `STATEMENTAUDIT_HANDOVER_2026-06-28_TRANSACTION-MODE-EXPANSION.md` (two-pathway build, commit `612b251`). All non-negotiables in that handover inherited intact — see Section 7 there.

**G7 labelling:** REASONED (unconfirmed) unless stated otherwise.

---

## What changed

Seven features built and pushed in one session. All use the "handed over to the user" credential model — no new ongoing costs to the app owner. All comply with the standing non-negotiables. None touch the approval gate, the balance walk, or the extraction prompts.

---

## Feature 1 — Batch limit 50

**Was:** 20 files max.  
**Now:** 50. Changed in `addFiles` (`Math.max(0, 50 - prev.length)`), upload drop-zone text, and Queue header text.  
**Non-negotiable impact:** None. The batch limit is a queue cap, not a gate.

---

## Feature 2 — UK VAT rule-pack (`vatUK`)

**Architecture:** Identical seam-guarded pattern to `gstJersey` (Module A, 2026-06-29). Lives at lines 73–95 in the source. Same SEAM GUARD comment.

**5 treatments:**
| key | label | Xero credit name | Xero debit name |
|---|---|---|---|
| standard20 | Standard Rate (20%) | 20% (VAT on Income) | 20% (VAT on Expenses) |
| reduced5 | Reduced Rate (5%) | 5% (VAT on Income) | 5% (VAT on Expenses) |
| zero | Zero Rated (0%) | Zero Rated Income | Zero Rated Expenses |
| exempt | Exempt | Exempt Income | Exempt Expenses |
| outside | Outside Scope / No VAT | No VAT | No VAT |

**Source:** HMRC · gov.uk/guidance/rates-of-vat-on-different-goods-and-services · Value Added Tax Act 1994. `verifiedAt: '2026-06-29'`. Expires after 365 days (same pattern as gstJersey). **Stephen must re-verify against HMRC annually before `vatUK.verifiedAt` expires.**

**New UI elements:**
- **Tax Jurisdiction** selector in upload form: `United Kingdom (VAT)` / `Jersey (GST)` / `Other / No Tax Column`. Default `uk`. Stored in `localStorage.sa_defaultJurisdiction`.
- **Per-file jurisdiction dropdown** in Queue rows (Xero only): `UK VAT` / `Jersey GST` / `No Tax`.
- **Coding modal** is now jurisdiction-aware: `jur = stmt.jurisdiction || 'uk'`, `hasTaxCol = isXero && jur !== 'other'`, `activePack = jur === 'jersey' ? gstJersey : jur === 'uk' ? vatUK : null`. Treatment column header, select options, rule-pack banner, `rulePackOk`, and `gstComplete` all driven by `activePack`.
- **`buildXeroPrecoded(txList, jurisdiction)`** — now takes a second param. Uses `gstJersey.xeroName` when `jurisdiction === 'jersey'`, `vatUK.xeroName`/`vatUK.xeroNameExp` when `'uk'`, `'No VAT'` default when `'other'`.

**verify.sh seam guard:** range updated from `74,140` to `98,170` — BASE_PROMPT moved to line 98 after vatUK insertion (26 lines). Seam guard still checks that `gstJersey` and `gstTreatment` do not appear in the extraction prompt block. **REASONED: seam guard passes 13/13; contents of vatUK verified by reading — no gstJersey/gstTreatment strings in it.**

**Non-negotiable inherited:** vatUK MUST NOT appear in `recalc`, the balance walk, reconciliation arithmetic, or `BASE_PROMPT`/`PROMPTS`. The engine is tax-agnostic. Treatment is metadata on the transaction, never an arithmetic input. Same rule as Module A.

---

## Feature 3 — Layer 2 AI coding suggestions

**What it is:** When the coding modal opens, all unknown payees (lines where `!l.fromMemory`) are batched to `POST /api/suggest-codes`. The server calls `claude-haiku-4-5` (~£0.01/session billed to the user's own `ANTHROPIC_API_KEY`). Suggestions return as `{normKey: {code, name}}` and are stored in `codingSuggestions` React state. Each unknown-payee line shows a purple **✦ code — name** button below the Account Code input.

**G6 compliance (Pathway 2 non-negotiable):**
- Layer 2 is proposals only. The purple button pre-fills the code field; the human ✓ gate still must be clicked.
- Layer 1 lookup (deterministic, from payeeMemory/categoryMemory) is unchanged. Layer 2 only fires for lines where Layer 1 found nothing.
- Once the user confirms a suggestion, it enters Layer 1 via the existing `toRemember` / `setCategoryMemory` path in `approve()` — learning is inherent.
- Failure is silent (`.catch(() => {})`). No suggestion is auto-applied. The gate is not degraded by a missing suggestion.

**REASONED:** Code path confirmed by reading. Cannot confirm suggestion quality without running real statements.

---

## Feature 4 — Multi-client project dashboard

**What it is:** New `renderDashboard()` function + 5th nav tab `◈ Projects`. Grid of project cards showing: name, approved/review/error/queued counts, last activity date. Click any card → `setActiveProjectId(p.id)` + `setTab('audit')`. `+ New Project` card calls `window.prompt()`.

**State used:** `projects` (existing), `stmts` (existing), `activeProjectId` (existing). No new state.

**No gate impact.** Dashboard is read/navigate only.

---

## Feature 5 — FX enhancement

**`detectFX(description)`** — regex against 21 major currency codes (`USD EUR AUD CAD JPY CHF NOK SEK DKK NZD HKD SGD ZAR MXN BRL INR CNY TRY AED SAR` + GBP exclusion). Returns `{currency}` or null.

**Review tab:** 💱 CCY badge in the description cell for matched transactions. Visual only, no arithmetic impact.

**Coding modal FX sub-row:** For lines where `detectFX(l.description)` matches, a sub-row appears below the tracking row showing: currency label, manual spot-rate input (`l.fxRate`), and a **Look up (free)** button. The button calls `https://api.frankfurter.app/{YYYY-MM-DD}?from={CCY}&to=GBP` (free public API, no auth, no account required). `txDateToISO(ddmmyyyy)` converts the transaction date.

**FX rate is reference-only.** It is stored on the coding line (`l.fxRate`) but is NOT written to the exported CSV, NOT used in any arithmetic, and NOT part of reconciliation. It exists purely as a reference note for the accountant.

---

## Feature 6 — Xero Chart of Accounts pull

**Architecture:** PKCE OAuth 2.0 flow. Entirely client-driven; user supplies their own Xero app credentials.

**Env vars required (optional — app works without them):**
- `VITE_XERO_CLIENT_ID` (client-side, injected by Vite)
- `XERO_CLIENT_SECRET` (server-side only, never exposed to client)

**Flow:**
1. `startXeroCoaAuth()` — generates PKCE verifier (stored in `sessionStorage.xero_coa_verifier`), computes SHA-256 challenge, redirects to `login.xero.com/identity/connect/authorize` with `scope=accounting.settings.read+offline_access`.
2. Xero redirects back with `?code=...&state=xero_coa`.
3. `useEffect` on mount intercepts, cleans the URL, calls `POST /api/xero-token` (server-side `XERO_CLIENT_SECRET` used; access token returned to client).
4. Client calls `GET /connections` → tenantId → `GET /api.xro/2.0/Accounts?where=Status=="ACTIVE"`.
5. Accounts set into `chartAccounts` state (replaces CSV import).
6. `alert()` confirms count.

**No token storage.** Access token held in closure only; not in `localStorage` or state that persists beyond the session.

**"Connect Xero" button** appears in the coding modal's chart panel only when `VITE_XERO_CLIENT_ID` is defined.

---

## Feature 7 — QuickBooks Online Chart of Accounts pull

**Architecture:** Intuit OAuth 2.0 (no PKCE — Intuit uses standard auth code flow with client_secret).

**Env vars required (optional):**
- `VITE_QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`

**Flow:** `startQboCoaAuth()` → Intuit OAuth → `?code=...&state=qbo_coa_*` → `useEffect` on mount → `POST /api/qbo-token` → access token → `GET /v3/company/{realmId}/query?query=select * from Account where Active = true`. Accounts → `chartAccounts`.

**Same no-storage rule as Xero.** "Connect QBO" button gated on `VITE_QBO_CLIENT_ID`.

---

## New server routes

| Route | Requires | What it does |
|---|---|---|
| `POST /api/suggest-codes` | `ANTHROPIC_API_KEY` (already required) | Batch payee → suggested code (claude-haiku-4-5) |
| `POST /api/xero-token` | `XERO_CLIENT_SECRET` + `VITE_XERO_CLIENT_ID` | PKCE token exchange with Xero |
| `POST /api/qbo-token` | `QBO_CLIENT_SECRET` + `VITE_QBO_CLIENT_ID` | Token exchange with Intuit |

All three routes: no storage, stateless, same pattern as existing `/api/extract`.

---

## Non-negotiables inherited (unchanged from 2026-06-28)

All Section 7 non-negotiables from `STATEMENTAUDIT_HANDOVER_2026-06-28_TRANSACTION-MODE-EXPANSION.md` are preserved. Specifically:
- Human approval gate is the ONLY path to any export — no auto-post, no bypass.
- Layer 1 coding is deterministic lookup only. Layer 2 suggestions are proposals; human ✓ required.
- Pathway 2 Xero export is single atomic precoded file.
- Pathway 2 scoped to empty periods only (hard gate preserved).
- QBO Code & Reference is reference-only (unchanged).
- FX rate is reference-only — not an arithmetic input anywhere.

---

## Audit anchors

- **Canonical source:** `src/statement-audit-pro.jsx` · 4799 lines · commit `ccf44ec`
- **verify.sh:** 13/13 green
- **Model pin:** `claude-sonnet-4-6` (resolved — verify.sh and GUARDRAILS.md agree)
- **vatUK seam guard:** `sed -n '98,170p'` must show zero hits for `gstJersey|gstTreatment`
