# StatementAudit Pro — Expansion Brief / Handover 2026-06-28

## Two-pathway model: Audit-&-Match and Catch-up Code-&-Create

**Changes since last handover:** Strategy session — no code changed. Reframed the expansion as **two named user pathways**. Corrected the catch-up mechanism to a **single atomic precoded import**. Fixed terminology: **"export" is the mechanism**; one-click API "push" is a deferred maybe. Viability stated on **evidenced** grounds. **Decision: build BOTH pathways now**, and **prove the Xero import live inside the build**. **Pathway 2 now carries its own audit control** — per-line coding confirmation (no blind approval), codes sourced from **payee memory or imported chart/lists/items/classes**, with optional friction switches that **can never disable the gate**. Beta plan + questions added.

**Baseline:** Sits on top of `STATEMENTAUDIT_HANDOVER_2026-06-26.md` (build `c20688c`, live on Render, 11/11 green). That handover + the live source remain the source of truth. Strategy/expansion brief for consideration.

**G7 labelling:** claims tagged **VALIDATED (coal face)**, **EVIDENCED (research)**, or **REASONED (unconfirmed)**.

---

## 0. How to use this — read first

- **Build both pathways** (Stephen's call). Pathway 1 already exists; Pathway 2 finishes from the existing precoded export, coding memory, and audit core — a few days of combined session time.
- **Prove the Xero precoded import live as a checkpoint *inside* the build** (Section 6.1) — not after, not assumed. If the file degrades to bare lines, catch it in code, not in front of a beta tester. **"Trustworthy" is the whole pitch.**
- **Confirm scope with Stephen before starting**, then build.
- A fork (save current, copy repo, build new app) **inherits every non-negotiable in Section 7**.

### Terminology — important
- **"Export"** = the app produces a file; the **user imports it**. Assumed mechanism throughout.
- **"Push"** (one-click API write into the ledger) is a **deferred, conditional option** — build only if proven both *doable* and *best*. Read "into Xero/QBO" as **export → user imports** unless push is separately proven.

---

## 1. The two pathways (the product shape)

User logs in, uploads statements, app offers **two pathways**, chosen by the state of the client's books:

### Pathway 1 — Audit & Match  *(books are maintained)*
The system already has the entries. Statements are **audited** (reconciled + integrity-checked) and lines exported for import; the **platform** matches them against existing entries during reconciliation.
- **Value here is the audit** — proving the statement is complete and reconciles *before* it reaches the ledger.
- **Universal:** Xero and QuickBooks today, via export+import.

### Pathway 2 — Catch-up: Code & Create  *(periods are empty / missing)*
The ledger has **no transactions** for the period. The bookkeeper uploads statements; the app **proposes a code for each transaction** — drawn from the **payee memory** *or* from the client's **imported chart of accounts / categories / classes / item lists** — and the user **confirms or corrects each line**. Only confirmed, coded lines pass. The entries are then created **already coded** and reconciled against the statement.
- Scoped to **empty periods only** — avoids Xero's "precoded lines collide with existing entries" error.
- Coding source is **deterministic**: a lookup against remembered payees or the imported lists, not a model-inferred category at Layer 1.

#### Pathway 2 — audit control (no blind approval)
Pathway 2 *creates* records rather than checking ones a human already made, so there is **no second set of eyes downstream**. The control has to be **in** the flow — and if anything, stronger than Pathway 1, not weaker:

- **Per-line confirmation.** Each code is a *proposal* the user confirms or corrects — **never auto-applied as fact.** (Source: payee memory or imported chart/lists/items/classes.)
- **Optional friction switches, with a hard floor.** Switches like "auto-confirm exact-match remembered payees" or "bulk-confirm this merchant" may cut clicks — but **no switch may turn the gate off.** Confidence-based fast-track is allowed (consistent with the existing Confidence Threshold System); blanket auto-approve is not.
- **Two checks, different questions — both must hold:**
  - **Coding confirmation** — "is this the right account / class?" (per line, the new step).
  - **Approval gate** — "does this statement reconcile and is it complete?" (the existing integrity/reconciliation gate, unchanged).
  - The coding step sits **in front of** the gate; it does **not** replace it. A fully-coded statement can still fail reconciliation → the gate stays the last hard stop.

> User-facing pathways, not two new engines. Both use the existing `buildQBO` / `buildXero` / `buildXeroPrecoded` / Audit Workbook builders, plus the new coding-confirmation step and (new) chart/list import for Pathway 2.

---

## 2. CRITICAL build instruction — Pathway 2 is ONE atomic import, not two pushes

The intuitive model is "create the transactions, then import the statement, then they match." **Do not build it that way.**

- On **Xero**, the **precoded import does both in a single pass** — creates the coded transaction **and** reconciles it against the statement line, from **one file**.
- Export transactions one way and the statement another, relying on them meeting inside Xero, and the statement line can **fail to match** and **double everything**.
- **Build the single precoded file. One export, one import, atomic.** (The per-line coding confirmation in 1 happens *before* this export; the file is built only from confirmed lines.)

---

## 3. What's already in the build (baseline — do NOT rebuild)

From the uploaded source (`statement-audit-pro.jsx`, ~3,434 lines):

- `buildQBO` → `Date,Payment Type,Description,Payee,Debit,Credit,Category,Nominal Code,Notes`
- `buildXero` → `Date,Amount,Payee,Description,Reference,Cheque Number,Analysis Code,Category`
- `buildXeroPrecoded` → `Date,Amount,Payee,Description,Reference,Account Code`
- `payeeMemory` + `categoryMemory` (deterministic); unrecognised → `Misc Expense` / `Misc Revenue` holding account; behind the gate.
- Audit Workbook — 3 sheets: Audit Review, QBO/Xero Import, Receipts.

**New for Pathway 2:** the per-line coding-confirmation step (Section 1) and the chart/list/items/classes import (Section 6.5). The existing coding memory and approval gate are reused, not replaced.

---

## 4. Platform reality — what each import door accepts (EVIDENCED)

| Destination | Pathway 1 (Audit & Match) | Pathway 2 (Code & Create) | Notes |
|---|---|---|---|
| **Xero** | Yes — export lines, platform matches | **Yes (prove in 6.1)** — single precoded import, coded + reconciled in one pass | The **headline**. Precoded export currently Account-Code-only. |
| **QBO (Plus/Essentials/Simple Start)** | Yes — export bank CSV, platform matches | **No** — native CSV strips codes | ~98% of QBO small clients. Degrades to "Pathway 1 + reference codes the user keys in." |
| **QBO (Advanced / Accountant)** | Yes | Narrowly — Spreadsheet Sync, **client's Advanced file only** | Advanced ≈ 1–2% of QBO base. |
| **QBO — any tier** | Yes | Via 3rd-party importer (SaaSAnt etc.) | Separate paid tool. |
| **Excel / Google Sheets** | N/A | **Yes, frictionless** — coded workbook *is* the ledger | Thinnest moat; capability, not headline. |

---

## 5. Audience sizing — why Xero leads (EVIDENCED)

- **UK/Channel Islands is Xero-dominant**, hardest in the accountant channel targeted. Feb 2026 UK ad-spend share: **Xero ~45% / QuickBooks ~18% / Sage ~13%** (momentum proxy, not installed-base). Xero 300,000+ UK businesses.
- **QBO Advanced** (only clean Pathway-2 tier) ~118,000 (2022) vs ~6.5M base → **~1–2%**.
- **US is the mirror** (QBO dominant). Build to the **UK** reality.

**Decision:** Lead Xero (full pipeline incl. Pathway 2). QuickBooks = supported smaller share — Pathway 1 for everyone + reference-coding; Pathway 2 deferred (effort + competition). Excel/Google = spillover.

---

## 6. Open / unproven — prove or fix during the build

1. **[PROVE DURING BUILD] Xero precoded import unproven live.** Xero treats **Tax Rate** as mandatory in the precoded template; a missing mandatory field makes the import silently fall back to plain, *uncoded* statement lines. Current `buildXeroPrecoded` omits Tax Rate (and Tracking).
   - **Action:** add `Tax Rate` (and optionally `Tracking1`/`Tracking2`); import into a Xero sample company.
   - **Pass:** coded, reconciled transactions with the account code applied. **Fail:** bare statement lines only.
   - **Prove during the build, before any demo.** If it fails, Pathway 2 on Xero falls back to Pathway 1 — adjust the demo and the coded-import claim, not the whole plan.

2. **Fix the wrong in-app guide line** (≈ line 2731): "Analysis Code column maps to Xero Tracking Categories" is **factually wrong** — Analysis Code is a bank reference label, not tracking, not the account code. Fix before any demo.

3. **Size the coding-memory advantage (research, not a gate).** Remembered-payee coding compounds across a backlog — catch-up is a multi-period stack, the best case for it. Ask a working bookkeeper how much catch-up time goes on recurring-recognised payees vs genuinely new ones (beta Q3). Calibrates the advantage; not a viability gate.

4. **Xero collision caveat.** Precoded lines matching existing invoices/bills introduce errors — *why* Pathway 2 is scoped to **empty periods only**. The app must enforce this.

5. **[NEW] Chart / list / items / classes import — confirm per platform.** Pathway 2 codes against the client's real taxonomy, so the app imports their chart of accounts, tracking categories, and item lists. Both Xero and QBO can **export** these — confirm the export-from-them / import-to-us format per platform before relying on it. Until imported, Pathway 2 falls back to payee memory + the Misc holding account. The import is a **list** the coding step looks up against — it stays deterministic.

---

## 7. Non-negotiables preserved (apply to any expansion or fork)

- **Human approval gate is the only path to any export OR push — including Pathway 2. No auto-post to a ledger, ever.** In Pathway 2, each coded line is a **proposal the user confirms or corrects** — coding is never auto-applied as fact. Friction switches (fast-track, bulk-confirm) may cut clicks but **none may disable the gate**: confidence-based fast-track only, never blanket auto-approve.
- Model transcribes; deterministic code does all arithmetic. Coding (memory **or** imported lists) stays a **deterministic lookup**, not model-inferred at Layer 1.
- No per-bank prompt zoo.
- Robust indexOf/lastIndexOf JSON extractor; no prefill; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; API key server-side only; no real personal bank details committed.
- **Compliance gate stands** (`COMPLIANCE_ASSESSMENT_2026-06-24`): no paid external customers until JOIC / Render DPA / Anthropic DPF / Privacy Policy / Customer DPA / RoPA are closed. Consented trials + internal demos fine. If a push (API write-path) is ever built, re-consult the Compliance adviser before go-live.

---

## 8. Viability — the evidenced case (researched need, market, gap)

**Verdict:** plausibly **all three** — fills a gap, offers real advantages, fits a defensible niche. Strongest on the **niche + audit/trustworthiness advantage**.

**Researched user need (EVIDENCED).** Catch-up / rescue bookkeeping is a real, recurring job. MTD for Income Tax (mandatory April 2026 at £50k, 2027 at £30k, 2028 at £20k) is forcing hundreds of thousands of sole traders and landlords onto digital records — a catch-up wave on a fixed timeline. Open Banking feeds are unreliable; CI/offshore banks often don't feed at all — a genuine PDF-first rationale.

**Market (EVIDENCED).** The category already has paying customers (DocuClipper, Datamolino, Dext) — WTP for the job is established. The platform where the clean coded pathway works (Xero) leads the UK accountant/bookkeeper channel.

**Gap / advantage / niche.**
- **Gap:** a unified pipeline — extract → reconcile → mandatory human audit gate → coded export — in one tool, vs a market split between extractors that don't code and coders that only work inside the ledger.
- **Advantages:** UK/CI bank-format accuracy; no-storage/EEA compliance story; deterministic upstream coding memory; reconciliation + integrity checks (two-anchor opening, balance-break detection) → **trustworthiness** as the selling point.
- **Niche:** UK/CI catch-up where correctness matters — **Channel Islands beachhead genuinely underserved** (no MTD pressure, offshore banks that don't feed, US tools that fumble local formats), reachable through Stephen's consultancy network.

**Honest texture (shape of the edge, not a doubt).** Reconciliation and categorisation are table stakes individually — DocuClipper does both. The defensible edge is the **combination + locale**: UK/CI accuracy + audit gate + no-storage + coding memory, aimed at a niche the big tools treat generically. The moat is the bundle and the focus, not any single feature.

---

## 9. Why the two-pathway model widens the use (REASONED)

Same upload + audit core serves both halves of bookkeeping: Pathway 1 for firms whose **books are kept** (assurance/audit, every period, universal); Pathway 2 for **catch-up/rescue** (proven-WTP, where the coding memory earns its keep). **Open question for the beta:** whether Pathway 1's audit step is something firms pay for, or get free in-platform (beta Q2).

---

## 10. Build sequence (build both; prove the import inside the build)

1. **Build out both pathways.** Pathway 1 exists; finish Pathway 2 from the existing precoded export, coding memory, and audit core.
2. **Build Pathway 2's audit control:** per-line code confirmation (propose from memory or imported lists → user confirms/corrects), optional friction switches with the **gate never bypassable**. Keep the two checks distinct (coding confirm, then the reconciliation gate).
3. **Add chart / list / items / classes import** (6.5) — confirm the export-from-platform format first; until then, payee memory + Misc holding account.
4. **Inside the build, prove the Xero precoded import live** (6.1) — add Tax Rate, import to a Xero sample company, confirm coded + reconciled. **Fix the Analysis-Code line** (6.2) while in there.
5. Build Pathway 2 on Xero as a **single atomic precoded import** (Section 2), from confirmed lines only — never the two-push version.
6. Make pathway selection **platform-aware**: Pathway 2's clean home is Xero (and Excel/Google); on QBO lower tiers, set the expectation up front or route to Pathway 1 + reference-coding. **Don't let a user pick a door their platform can't open.**
7. **Test Xero and QBO Online.** Expect QBO to **confirm the wall** on lower tiers — document the boundary; demo reference-coding there.
8. Then beta (Section 11).

---

## 11. Beta — testers and the questions to answer

**Who:** 3–4 working UK/CI bookkeepers or practice staff, as **consented trial users** (compliance-fine per Section 7; no paid external customers yet).

**Why:** the beta decides what to keep and what to charge for — especially the board's open question about Pathway 1. Capture answers verbatim where you can.

**Ask:**
1. **Which pathway would you actually pay for** — auditing books that already reconcile (Pathway 1), catch-up coding of empty periods (Pathway 2), or both?
2. **[board's open Q]** Would you pay for the **audit/reconciliation step on books that already reconcile** inside Xero/QBO, or is that something you get free in-platform? (If "free in-platform," Pathway 1 may be a CI-niche feature, not a universal one.)
3. **For catch-up:** roughly how much of your time goes on **recurring-recognised payees** (where the coding memory compounds) vs genuinely new ones? (Sizes the coding-memory advantage — 6.3.)
4. **On QuickBooks lower tiers**, coded import isn't possible — is **reference-coding** (the app gives the codes as a crib sheet you apply in QBO) worth paying for?
5. **Subscription or pay-per-use?** Catch-up is episodic (a burst at onboarding, then quiet) — which pricing shape would you actually buy?

---

## 12. Resume protocol

```bash
cd statementaudit-pro
bash verify.sh            # must be 11/11 green
```

Then load: `STATEMENTAUDIT_HANDOVER_2026-06-26.md` (build truth) + this brief + live `src/statement-audit-pro.jsx`. Confirm scope with Stephen before building. **Build both pathways; Pathway 2 keeps a per-line coding-confirmation audit step (gate never bypassable); prove the Xero precoded import inside the build (6.1); build Pathway 2 as one atomic import from confirmed lines, not two pushes (Section 2).**

---

*Strategy-channel brief, 2026-06-28. The latest dated build handover and the live source win over this file on current build state. Build both pathways; Pathway 2 has its own per-line audit control; prove the Xero import inside the build. "Export" = user imports the file; "push" (one-click API) is deferred and conditional.*
