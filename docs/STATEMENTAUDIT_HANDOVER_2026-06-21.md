# StatementAudit Pro — Session Handover

**Date:** 2026-06-21
**Changes since last handover:** No application code changed this session — it was document reconciliation, platform-alignment research, a credit-card extraction test, and build planning. Reconciled the docs to the live 1,533-line build (README, brief, project instructions header). Researched the QuickBooks Online and Xero CSV-import specs and audited both CSV builders against them. Decided the export strategy ("two doors"). Ran all 20 HSBC credit-card statements through the app as the item-3 evidence test. Diagnosed the "17 possible missing statements" dashboard misfire. Two Claude Code jobs are queued below, fully written. Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-18.md`.

---

## How to resume (read this first)

1. Paste this handover as the first message.
2. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,533** (no code changed this session).
3. Load the live `src/statement-audit-pro.jsx` (1,533 lines).
4. First action when ready to build: **Claude Code Job 1** below (Xero pre-coded builder), then **Job 2** (period-gap threshold fix).

---

## Document reconciliation done this session

The live build is correct and current; the drift was only in the written docs. Brought into line with 1,533:
- `README.md` — status date → 2026-06-18, line count → 1,533, item-4 scenario-2 recorded as shipped. (Updated file provided.)
- `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` — header line-count reference → 1,533 (the body was already the corrected b9ba7f4 version). (Updated file provided.)
- `00_START_HERE_REBUILD_BRIEF.md` — line-count reference → 1,533. (Updated file provided.)

**One housekeeping item to confirm:** `README.md` dropped out of the Claude.ai **project files** during the last re-upload and may still be missing there. Re-upload it so a fresh chat sees it. (Desktop repo is fine; this is only the project-knowledge copy.)

---

## Platform-alignment research (the proactive win) — findings

Audited both CSV builders against the **current** QuickBooks Online and Xero import specs.

- **Xero — well aligned.** Our `buildXero` (`Date,Amount,Payee,Description,Reference,Cheque Number,Analysis Code`) matches Xero's bank-statement import template closely: single signed Amount (money-in positive, money-out negative), payee/description/reference all recognised, unrecognised extra columns silently ignored. DD/MM/YYYY is correct for UK/Jersey.
- **Xero has a *second* native door — "Import a precoded statement"** — that additionally accepts an **Account Code** (code only, not the name) and a Tax Rate, so transactions arrive already coded. This is the path that delivers the product's "finished before you open the books" promise, and it is what **Job 1** targets.
- **QuickBooks Online — material misalignment.** QBO's native bank-CSV import accepts only **3 columns (Date, Description, Amount)** or **4 columns (Date, Description, Credit, Debit)**. Our 8-column QBO file does not fit that door — the extra Payment Type / Payee / Nominal Code / Notes columns don't import; QBO adds payee and category *after* import via the For Review screen or bank rules. **There is no native CSV path that carries pre-coding into QBO** — that needs a third-party importer or the direct API push already on the roadmap.

**Decision (the "two doors" strategy):**
- **Xero:** offer both files — plain (code in Xero) and pre-coded (arrives coded). Pre-coded is the differentiator. **Build now (Job 1).**
- **QuickBooks:** the always-works plain file now; the pre-coded QuickBooks experience comes later via the **direct API push**, not a CSV. (Do **not** ship a rich 8-column QBO file as a "native upload" option — it would fail or strip the coding at QBO's import screen, i.e. a barrier.)
- Open sub-decision (not blocking): if/when we keep an 8-column QBO output at all, it's for a third-party importer or the API path — and the in-app QBO import guide must name *that* path, not QBO's native Banking upload.

---

## Credit-card extraction test (item 3 evidence)

Ran all **20 HSBC credit-card statements** through the live app (account type = Credit Card). Results against the four checks:

1. **Reconciliation — PASS.** All 20 reconcile green.
2. **Dates — PASS.** No transaction-date / posting-date mix-up observed (the transaction date is landing).
3. **Phantom rows — PASS.** No summary-box figures (minimum payment, credit limit, etc.) extracted as transactions.
4. **Flags — present, not yet characterised.** There were amber/flagged rows; we did **not** get to confirm whether they're the benign kind (same-day-repeat "verify" badges, or the model's own `ambiguous` marks) or sitting on a genuinely mis-read row.

**Status of item 3:** all but closed. The credit-card prompt is solid on the three suspected gaps (CR sign already fixed 06-17; dates and phantom rows clean on real statements). **The one open thread is point 4** — characterise the flags. **Resume by asking:** roughly how many flags, and on a glance are they "repeated charge / I wasn't sure" (benign — item 3 closes clean) or any flag sitting on a row whose type/payee/direction is actually wrong (→ a real Phase-2 fixture)?

---

## "17 possible missing statements" — diagnosed (the period-gap misfire)

**What it is:** the dashboard's period-gap detector (`detectPeriods`) lines up the date ranges of all loaded statements, sorts them, and flags a "possible missing statement" whenever one statement's end and the next's start are **more than one day apart**.

**Evidence:** 20 statements loaded in correct issue order → 19 joins → **17 flagged**. Genuinely consecutive statements should flag **zero**. So this is a false alarm, not 17 absent months.

**Separate proof from guess:**
- **CERTAIN (read in code):** the `diff > 1` threshold is the bug. A genuinely missing monthly statement leaves a ~30-day hole; a 1-day threshold treats a harmless few-day gap the same as a month-sized hole. The detector also pools across accounts (no per-card scoping), though the in-order single run didn't exercise that.
- **HYPOTHESIS (~medium):** the few-day gaps exist because each statement's captured `period` is likely the **transaction span** (first→last transaction) rather than the printed **billing cycle**, so every statement appears to end a few days before the next begins. Confirm by eyeballing one statement's `period` against the printed cycle dates on the PDF. (Not needed to ship the fix — the threshold is the real defect.)

**Impact:** none on data — all statements reconcile and CSVs are correct; `period` only drives this one warning (and the CSV filename). It's a trust/noise issue. **Fix = Job 2.**

---

## CLAUDE CODE JOB 1 — Xero pre-coded builder (do first)

**Goal:** add a second Xero export that targets Xero's "Import a precoded statement" door, carrying the nominal code as an Account Code so coding arrives in Xero. Minimum change; no prompt, no approval gate, no other non-negotiable touched.

**Honest scope note:** today this carries the codes a human typed into the grid — it does not auto-code. The value now is "don't re-code everything again in Xero"; full auto-coding is the standalone-era semantic-categorisation feature. Build anyway — it's small, it's the right format, and it's ready the moment auto-coding exists.

### 1a. Add the builder (place directly after `buildXero`, ~line 247)

```javascript
const buildXeroPrecoded = txList => {
  const h = 'Date,Amount,Payee,Description,Reference,Account Code';
  return [h, ...txList.map(t => {
    const amt = t.credit != null ? t.credit : t.debit != null ? -t.debit : '';
    const p = (t.payee||'').replace(/"/g,'""');
    const d = (t.description||'').replace(/"/g,'""');
    return `${t.date},${amt},"${p}","${d}",${t.paymentType},${t.nominalCode||''}`;
  })].join('\r\n');
};
```

This mirrors `buildXero` exactly (single signed amount, same escaping, `\r\n`); it replaces the trailing `Cheque Number,Analysis Code` columns with a single `Account Code` drawn from `t.nominalCode`. Tax Rate is deliberately omitted — there's no tax field on the transaction yet, and adding one is a bigger change than this should be.

### 1b. Give `makeName` an optional suffix (replace the existing `makeName`)

```javascript
const makeName = (s, suffix='') => {
  const bank = (s.bankName||'Bank').replace(/\s+/g,'_');
  const plat = (s.platform||'qbo').toUpperCase();
  const sfx  = suffix ? `_${suffix}` : '';
  if (!s.period?.from) return `${bank}_${plat}${sfx}.csv`;
  const d = str => str.split('/').reverse().join('-');
  return `${bank}_${d(s.period.from)}_to_${d(s.period.to)}_${plat}${sfx}.csv`;
};
```

The default empty `suffix` keeps every existing `makeName(s)` call unchanged.

### 1c. Add a second export option in the export step (`renderExport`)

Two small UI additions. Match the existing `btn(...)` styling — check the `btn` helper for available variants and use a muted/secondary one if present, otherwise reuse `btn('primary')` and distinguish by label.

- **Per-statement list** (next to the existing `↓ Download` button, ~line 1424): for Xero statements only, add
  ```jsx
  {s.platform==='xero' && (
    <button onClick={() => dlFile(buildXeroPrecoded(getTx(s)), makeName(s,'PRECODED'))} style={btn('secondary')}>↓ Pre-coded</button>
  )}
  ```
- **Merged exports** (next to the existing `Merged_Xero.csv` button, ~line 1379): add
  ```jsx
  <button onClick={() => dlFile(buildXeroPrecoded(xeroApproved.flatMap(s=>getTx(s)).sort((a,b)=>pDate(a.date)-pDate(b.date))), 'Merged_Xero_Precoded.csv')} style={btn('secondary')}>Merged Xero (pre-coded)</button>
  ```

### 1d. Verify & close
- `bash verify.sh` → must stay **ALL CHECKS PASSED** (no fingerprinted non-negotiable was touched).
- Set `expected_lines:` in `VERSION` to the new `wc -l` of the jsx; bump the `.jsx` `Last updated:` header to 2026-06-21.
- `git add -A && git commit -m "feat: Xero pre-coded CSV export (Account Code column) + makeName suffix"`.
- Live-verify: process a Xero statement, confirm the new pre-coded file downloads with an `Account Code` column populated from the nominal codes.

---

## CLAUDE CODE JOB 2 — period-gap threshold fix (do second)

**Goal:** stop the gap detector flagging harmless few-day joins as missing statements, while still catching a genuinely missing period. Deterministic, bank-agnostic.

Replace `detectPeriods` (~lines 286–296) with:

```javascript
const detectPeriods = stmts => {
  const sorted = stmts.filter(s => s.period?.from && s.period?.to)
    .sort((a,b) => pDate(a.period.from) - pDate(b.period.from));
  const gaps = [], overs = [];
  const DAY = 86400000;
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i], next = sorted[i+1];
    const diff = (pDate(next.period.from) - pDate(curr.period.to)) / DAY;
    // Yardstick: a genuinely missing statement leaves a hole about as long as a statement.
    const span = Math.max(1, (pDate(curr.period.to) - pDate(curr.period.from)) / DAY);
    const threshold = Math.max(20, span * 0.5);
    if (diff > threshold) gaps.push({ from:curr.period.to, to:next.period.from });
    if (diff < 0)         overs.push({ a:curr.bankName||curr.filename, b:next.bankName||next.filename });
  }
  return { gaps, overs };
};
```

Effect: monthly statements (span ~30) get a ~20-day threshold, so a few-day join no longer flags but a missing month (~30-day hole) still does; quarterly statements (span ~90) get a ~45-day threshold and still catch a missing quarter. Expected result on the 20-in-order run: **0 gaps**.

**Deliberately not changed (minimum change):**
- The overlap test (`diff < 0`) and the cross-account pooling are left as-is. Per-account scoping (by sort code + account number) is a separate, optional refinement — only needed if a future run mixes multiple cards and false overlaps appear.
- The transaction-span-vs-cycle `period` reading is *not* chased here; the threshold is the real defect. If we later want the filename/period to show true cycle dates, that's a separate prompt/period item.

**Verify & close:** `bash verify.sh` green; set `expected_lines:` in `VERSION`; bump the `.jsx` header date; `git add -A && git commit -m "fix: period-gap detector threshold scaled to statement span (clears false 'missing statement' alerts)"`. Live-verify by re-loading the 20 in-order statements → expect no "missing statement" alert.

---

## Backlog / parked (unchanged unless noted)

- **Credit-card flags (point 4)** — characterise on resume (see item-3 section above).
- **Two extraction errors from 06-18** (Amazon £4.99 sign-flip; SOJ parking £1.27 page-break drop) — Phase-2 prompt-tuning fixtures, not hot-fixes.
- **QBO 8-column file** — keep only if targeting a third-party importer / the API push; otherwise the plain QBO file is the native deliverable. Decide when the QBO import path is finalised.
- **Direct API push to QBO** — the real route for pre-coded QuickBooks; roadmap Phase 2.
- Edge cases logged 06-17 (two-date layouts, leading-CR placement, etc.) — none reproduced on the HSBC credit-card run; leave parked.

---

## Roadmap (sequenced)

- **Phase 1 — extraction accuracy:** items 1 (Lloyds ✅), 2 (direction detect ✅), 3 (credit-card — extraction verified clean on 20 real statements; flags to confirm), 4 (dupe tuning — scenario 2 ✅; 1+3 deferred). **Plus two small build jobs queued this session** (Xero pre-coded export; period-gap fix).
- **Phase 2 — controlled benchmark (outside the artifact):** 20/20/20 OpenAI-vs-Anthropic, deciding metric = manual corrections per 100.
- **Phase 3 — provider abstraction in standalone, only if Phase 2 earns it.**

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; `@`/`Visa Rate` foreign-transaction rule; UTF-8 BOM on export; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV; one general rule per account type, no per-bank prompt library; never persist real personal bank details; test data synthetic / own / consenting / public-authority transparency PDFs only.

---

## Next steps

1. Re-upload `README.md` to the Claude.ai project files (it dropped out of project knowledge).
2. Claude Code **Job 1** (Xero pre-coded builder), then **Job 2** (period-gap fix) — each with `verify.sh`, a `VERSION` bump, and a commit.
3. Confirm the credit-card flags (point 4) to close item 3 cleanly.
4. Optional, anytime: run the three sample CSVs through the QuickBooks Test Drive and Xero Demo Company to see the two-door difference firsthand (see `DEMO_COMPANY_IMPORT_STEPS_2026-06-21.md`).
5. Then choose: scaffold the Phase-2 benchmark, or pick up the direct-API-push scoping for pre-coded QuickBooks.

---

*Standing session rules: plan first · verify in the running app · separate proof from guess · human gate non-negotiable · flag assumptions one at a time · minimum change · plain language · confirm before any file save or delete · never persist real personal bank details.*
