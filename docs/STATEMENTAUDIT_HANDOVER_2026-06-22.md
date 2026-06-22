# StatementAudit Pro — Session Handover

**Date:** 2026-06-22
**Changes since last handover:** No application code changed *by this chat* (two-channel discipline kept). Claude Code **Jobs 1 & 2 from 06-21 landed and were live-verified** this session (build now **1,555 lines**): Xero pre-coded export works (quoting confirmed correct on fresh files; a real comma-in-description row proved the quoting matters), and the period-gap detector no longer false-fires. **Item 3 (credit-card edge cases) is CLOSED** — the flags were benign. **Most importantly:** using Stephen's own ground-truth PDFs, the recurring "errors remain" faults were diagnosed to a **single proven root cause** (direction read from payment-type code, not column) plus two known secondary classes. A **standalone trigger** was identified (side-by-side PDF blocked in-artifact) — see `DECISION_RECORD_2026-06-22_standalone-trigger.md`. Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-21.md`.

---

## How to resume (read this first)

1. Paste this handover as the first message.
2. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,555** (Jobs 1 & 2 landed; +22 from 1,533).
3. Load the live `src/statement-audit-pro.jsx` (1,555 lines).
4. First build action: **Claude Code Job 3** (direction flag-and-correct) — the priority. Then **Job 4** (parser robustness). Both below, fully scoped.
5. Strategic: review and confirm `DECISION_RECORD_2026-06-22_standalone-trigger.md` before standalone work begins.

---

## Closed this session

### Item 3 — credit-card edge cases: CLOSED
The amber/flagged rows on the 20 HSBC credit-card statements were all benign: same-day legitimate repeats (two £0.97 parking app top-ups) and a same-date/same-amount pair that is genuinely two different transactions (two BA tickets, different passengers, sequential refs ...552/...553). All reconcile with both rows present, so they are real. No mis-read row. Item 3's three suspected gaps (CR sign, dates, phantom rows) were already clean; this was the last open thread.

### Jobs 1 & 2 — live-verified
- **Job 1 (Xero pre-coded export):** header `Date,Amount,Payee,Description,Reference,Account Code` correct; nominal codes land in Account Code; payee/description correctly quoted. Proof it matters: a real row `"EASYJET ... LUTON, BEDS ..."` contains a comma — quoting kept it one field. An earlier *unquoted* pre-coded file turned out to be **stale** (from an earlier builder); the current 1,555 build quotes correctly.
- **Job 2 (period-gap threshold):** span-scaled threshold in place; the false "17 missing statements" is gone.

---

## THE BIG FINDING — direction errors have one proven root cause

Stephen supplied the **ground-truth PDFs** for the failing statements, so for the first time the cause is **proven by arithmetic**, not hypothesised. Four direction errors across two sessions are all the **same fault**:

> **Transaction direction (money in vs money out) is being inferred from the payment-type code, not from which money column (Paid out | Paid in) the amount sits in.**

The HSBC two-column layout is the only reliable direction signal, because **the same code appears in both columns**:

- **2025-07 statement (PROOF):** `TFR ... INTERNET TRANSFER` appears as a **£2,500 debit** (16 Jun) *and* a **£300 credit** (22 Jun) in one statement. The app read the £2,500 as a credit → exactly **£5,000 variance** (2×2,500). Only the column distinguishes them.
- **2024-05 statement (PROOF):** `BP FRANKHAM P&A "Louise gift" £10` and `BP SHOBBROOKWA "Somatic Movement" £360` are both **money in** (in the Paid-in column) but coded "BP" (usually out). App read both as debits. £10+£360 = £370 wrongly moved in→out → the exact **£20** and **£720** integrity breaks (2×10, 2×360).
- **2025-08 statement:** £4.46 break = a **page-break duplicate drop** (two near-identical foreign rows, refs ...001/...002, €5 = £4.35 + £0.11, straddling the page boundary; one dropped). Same class as the 06-18 SOJ-parking case. The integrity check caught it.
- **2023-03 statement:** reconciles perfectly on paper; the app failure was a **JSON parse error** (`non-whitespace after JSON`), i.e. model-output/parser robustness — a *distinct* cause (→ Job 4).

**Separate proof from guess:**
- CERTAIN (arithmetic, verified against the PDFs): the *what* of every case above, and that the dominant cause is direction-from-code.
- HYPOTHESIS (high): the parser error is a second JSON block / trailing content — confirm by capturing the raw model output.

**Crucial reframe:** in every direction case the app **withheld the green tick and flagged the exact span**. The maths and the gate did their job — no wrong number could reach a CSV. These are the product *catching its own extractor's mistakes*, not the product failing. But four proven instances of one cause is exactly the evidence bar that justifies *preventing* it now (G4), rather than only logging it.

This is the **prevention half of Phase-1 item 2** (direction), previously deferred as "optional." It is now evidence-backed and is **Job 3**.

---

## CLAUDE CODE JOB 3 — direction flag-and-correct (PRIORITY)

**Goal:** stop direction-from-code errors at the prompt, and where the printed balance contradicts the model's sign, **flag and offer a one-click correction** (never silent auto-override — the human gate stays central). Fixtures = the four ground-truth PDFs Stephen supplied.

**This touches safety-critical areas (G6):** the extraction prompt and the `recalc` arithmetic. `verify.sh` MUST stay green; the foreign-transaction rule (`@`/`Visa Rate`), the CR/credit-marked-balance rule, and the human gate MUST NOT be disturbed. Suggest splitting into 3A (prompt) and 3B (cross-check + UI) and committing separately.

### 3A — Prompt rule (prevent). General two-column rule; NOT per-bank.
Add to the current and savings prompts (debit-positive credit-card/loan layouts are single-column, so scope to credit-positive two-column layouts). Carry verbatim, adapting placement to the existing prompt structure. Do **not** alter the foreign-transaction or CR rules.

> **Direction is determined SOLELY by which money column the amount appears in.** The left money column ("Paid out") is always money out (debit). The right money column ("Paid in") is always money in (credit). NEVER infer direction from the payment-type code: the same code (DD, BP, SO, TFR, CR, VIS, etc.) can appear in EITHER column. A "BP" or "TFR" amount in the Paid-in column is money IN (a refund, gift, or reversal); the same code in the Paid-out column is money OUT. When a row's code suggests one direction but the amount sits in the other column, the COLUMN wins.

Verify after: `verify.sh` green (prompt fingerprints for foreign-tx and CR must still match).

### 3B — Deterministic balance cross-check + flag-and-correct (detect/correct).
Use the already-captured printed running balance. HSBC prints a balance once per **day** (end of day), so work per balance-anchored span:

Algorithm:
1. Walk the transactions between two consecutive printed balances (this is what the existing integrity check / `balanceBreaks` already does).
2. For each span: `printedDelta = balanceAfter − balanceBefore`; `modelDelta = sum(credits) − sum(debits)` for the span.
3. If `|printedDelta − modelDelta| ≥ 0.01`, the span contains an error (already detected today via `balanceBreaks`).
4. **New — pinpoint the likely sign-flip:** if the discrepancy equals **2 × X** where exactly one transaction in the span has amount `X` (debit or credit), that transaction is the likely flipped row. (Flipping a row of amount X changes the span net by 2X — this signature matched BOTH proven cases: 2×2,500 → the TFR; 2×10 and 2×360 → FRANKHAM and SHOBBROOKWA.)
5. **Flag-and-correct UI:** on the pinpointed row, show a plain-language flag with a one-click accept, e.g. *"This looks like money IN — your statement shows it in the Paid-in column. Change to credit?"* Accepting flips debit↔credit and re-runs `recalc`. Never auto-apply without the click.
6. **Fallback:** where the 2×X signature does not uniquely match one row (multi-error span, or two rows share amount X), keep the existing span-level red banner — do not guess.

Honest limits (state in the flag copy, do not over-claim):
- Per-row certainty only where a single transaction sits between two printed balances, or where the 2×X signature is unique. Otherwise it is a span-level flag, as now.
- This is detection + *suggested* correction, not silent auto-correction. That is deliberate — the human gate is the product.

Verify after (live, not just harness):
- Re-process all four fixture PDFs. Expected: each previously-failing statement now either extracts correctly (3A prevented it) OR shows a precise flag with the correct one-click fix that, once accepted, reconciles green (3B).
- `verify.sh` green; `recalc` arithmetic unchanged for already-correct statements (regression-check the 20 HSBC credit-card set and any Lloyds fixtures — they must still reconcile).
- Set `expected_lines:` in `VERSION`; bump `.jsx` `Last updated:` to 2026-06-22; `git commit`.

**Verification UX caveat (links to the decision record):** the auditor confirming a 3B flag should ideally see the source PDF beside the grid. In-artifact, `Show PDF` can only "open in a new tab" (inline blocked). That is the validation-phase compromise; the true side-by-side is a standalone feature — see `DECISION_RECORD_2026-06-22_standalone-trigger.md`.

---

## CLAUDE CODE JOB 4 — parser robustness (the JSON error)

**Goal:** stop a statement erroring out entirely on `Unexpected non-whitespace character after JSON` (seen on the 2023-03 statement). A statement that won't open is worse than one that opens flagged.

**Cause — HYPOTHESIS (high), confirm with raw output:** the model emitted two JSON objects (`{...}{...}`) or trailing content; the current extractor slices `indexOf('{')`→`lastIndexOf('}')`, which then spans both objects and `JSON.parse` fails after the first.

**Fix (robust regardless of exact cause):** keep the current slice as the first attempt; if `JSON.parse` throws, fall back to a brace-depth scanner that extracts the **first complete top-level `{...}` object** (walk characters, track `{`/`}` depth respecting strings, stop at depth 0) and parse that. Do **not** weaken to a plain `JSON.parse(raw)` (non-negotiable). No prefill (non-negotiable).

**Confirm the cause properly:** capture one raw model response for the failing statement before/while fixing, so the hypothesis is verified, not assumed.

Verify: re-process 2023-03 → opens and reconciles (it reconciles on paper). `verify.sh` green; commit.

---

## Backlog (logged, not for Jobs 3/4)

- **Decimal precision in Xero builders.** Amounts export unpadded (`-1.7`, `5`, `-649`) — should be 2dp (`+parseFloat(n).toFixed(2)`) in both `buildXero` and `buildXeroPrecoded` (handle the empty-string case). Pre-existing in `buildXero`; inherited by pre-coded. Xero imports it fine, so non-blocking — small Claude Code job. Touches the financial-precision standard, so confirm before landing.
- **Sage as an export target.** Market research done this session: UK is fragmented, no dominant vendor; Xero leads the practice channel (>1m UK subs), QuickBooks strong second, Sage large but split across products (50/200/Business Cloud) and rated poorly for *bookkeeping* by practitioners. Decision: **do not build Sage now**; drop "and others" as undefined. If/when Sage earns it (a real prospect, or post-standalone SEO), target **Sage Business Cloud Accounting** first, and research its import spec then. Gated on a real signal.
- **Two 06-18 fixtures** (Amazon £4.99 sign-flip; SOJ parking page-break drop) — now subsumed: the sign-flip is a Job-3 case; the page-break drop is the 2025-08 class (detection works; prevention is a harder, separate prompt item if ever needed).

---

## Standalone trigger — see decision record

`DECISION_RECORD_2026-06-22_standalone-trigger.md` (drafted this session, awaiting Stephen's confirmation): the side-by-side PDF audit view is the first feature with a real, evidenced need that the artifact **structurally cannot** deliver (inline PDF blocked — proven live). Per the 06-12 logic, that is a trigger. Recommended path: finish Job 3 in-artifact (the sandbox can deliver it), then begin standalone Phase 1 (UI port + Node/Express proxy + PDF.js side-by-side, stateless default) in Claude Code. Board: unanimous to move; finish the in-artifact fix first.

---

## Current state

- **App:** 1,555-line build; Jobs 1 & 2 live-verified; `verify.sh` green.
- **Provider:** Anthropic, pinned `claude-sonnet-4-20250514`. Benchmark before any change.
- **Open build items:** Job 3 (direction flag-and-correct) — priority; Job 4 (parser robustness). Then the standalone decision.

---

## Roadmap (sequenced)

- **Phase 1 — extraction accuracy:** items 1 (Lloyds ✅), 2 (direction — detect ✅; **prevent + flag-correct = Job 3, evidence-backed this session**), 3 (credit-card ✅ closed), 4 (dupe tuning — scenario 2 ✅). Plus Job 4 (parser).
- **Standalone Phase 1 (NEW, gated on the 06-22 decision):** UI port + Node/Express proxy + PDF.js side-by-side viewer + stateless default, in Claude Code.
- **Phase 2 — controlled benchmark (parked gate):** 20/20/20 OpenAI-vs-Anthropic, metric = corrections per 100. The four ground-truth PDFs are now real fixtures. Run only when a decision rides on it.
- **Phase 3 — provider abstraction in standalone, only if Phase 2 earns it.**

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor (Job 4 extends it, never weakens it), no prefill; `@`/`Visa Rate` foreign-transaction rule; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV; one general rule per account type, no per-bank prompt library (Job 3's column rule is a general two-column rule, not per-bank); never persist real personal bank details; test data synthetic / own / consenting / public-authority transparency PDFs only.

---

## Next steps

1. Confirm `DECISION_RECORD_2026-06-22_standalone-trigger.md` (or push back) before standalone work starts.
2. Claude Code **Job 3** (direction flag-and-correct: 3A prompt rule, then 3B balance cross-check + flag UI), with the four PDFs as fixtures — `verify.sh`, `VERSION` bump, commit per sub-job.
3. Claude Code **Job 4** (parser robustness), capturing one raw model output to confirm the cause.
4. Commit this handover + the decision record into `docs/`.
5. Then: begin standalone Phase 1 scoping, or run the now-fixtured Phase-2 benchmark — Stephen's call.

---

*Standing session rules: plan first · verify in the running app · separate proof from guess · human gate non-negotiable · flag assumptions one at a time · minimum change · plain language · confirm before any file save or delete · never persist real personal bank details.*
