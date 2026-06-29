# StatementAudit Pro — Claude Code Build Brief: Module A (Jersey GST-aware coding)

**Date:** 2026-06-29 · **For:** Claude Code (single channel) · **Status:** DRAFT for Stephen's review. Queued — do NOT start until the precondition gate (§0) is met.

**Changes since last handover:** Strategy session — no code changed. Scopes **Module A**: a deterministic Jersey-GST treatment per transaction, confirmed at the existing coding gate, carried into the Xero precoded export. Establishes the one irreversible architectural call — **the engine must stay GST-agnostic** — and the rate-maintenance discipline (official-source-only, versioned rule-pack, stale-rate hard-stop).

**Baseline:** Live build, uploaded `src/statement-audit-pro.jsx` = `client/src/App.jsx` (3,773 lines, byte-identical — mirror in sync as of 2026-06-29). Model `claude-sonnet-4-6`. Sits on top of the 06-28 two-pathway build.

**G7 labels:** every claim tagged `VERIFIED LIVE` (named check) or `REASONED (unconfirmed)`.

---

## 0. Precondition gate — do NOT build through this

Start Module A only when **all** are true:

1. The open **Render-push testing questions** Claude Code raised last session are answered by Stephen and closed. This job waits behind them. (One job at a time.)
2. `bash verify.sh` prints **ALL CHECKS PASSED** at the current `VERSION` line count.
3. `App.jsx` ↔ `src/statement-audit-pro.jsx` diff is clean (they're in sync now — keep them in sync; the `cp` is manual and nothing enforces it).
4. Scope below is **confirmed with Stephen** (the DECISION NEEDED items in §6 are answered), and the GST rule-pack data (§5) has been sourced from Revenue Jersey — **not** invented.

If any is false, stop and resolve it first.

---

## 1. The one thing not to get wrong — the seam (irreversible)

**The engine must not know GST exists.** GST treatment is a **Jersey rule-pack**, isolated from the shared engine (extraction, `recalc`, reconciliation, the cross-check). Concretely:

- GST treatment is **metadata that rides alongside a transaction** — it must **never** enter `recalc`, the reconciliation arithmetic, the balance walk, or the extraction prompt. Reconciliation is on amounts; a tax treatment cannot change whether a statement reconciles.
- All GST knowledge (the treatment list, the treatment→Xero-tax-name map, the rate version) lives in **one isolated module/object** (e.g. a new `gstJersey` rule-pack — separate file or a single clearly-bounded config block), consulted only by (a) the coding-confirm step and (b) the Xero precoded builder.
- This is the moat the CI strategy rests on: the engine is shared across jurisdictions; forking it per jurisdiction would triple maintenance. **Keeping the seam clean is the only architectural call here that is expensive to reverse — get it right first.**

Add a `verify.sh` fingerprint (G6) that fails if `recalc` / the extraction prompt reference any GST symbol — locks the seam so a future session can't bleed GST into the engine. Flag the wording to Stephen.

---

## 2. What's already there (so you don't rebuild it)

`VERIFIED LIVE` (read from uploaded source, 2026-06-29):
- `buildXeroPrecoded` already emits the column Xero needs: header `…,Account Code,Tax Rate,Tracking1,Tracking2` (~line 396). The `Tax Rate` value is **hard-coded** `code ? 'No VAT' : ''` (~line 403). **This placeholder is what Module A replaces.**
- The per-line coding gate exists: `openCodingModal` / `codingLines` / `updateCodingLine` / `exportP2` (~lines 1328–1366). Each confirmed line already gets `nominalCode` + `category`. Module A adds a **parallel GST-treatment field**, confirmed the same way.
- Coding memory exists: `categoryMemory` / `payeeMemory` via `normKey`. Module A adds a **treatment memory** on the same pattern.

So Module A is small and additive: a treatment field + a rule-pack + a memory + one export-line change. No new engine.

---

## 3. Scope — what to build (Pathway 2 / precoded path only)

GST treatment only matters where a **precoded Xero file** is produced — i.e. the Code & Create (Pathway 2) flow. Build it there.

1. **Rule-pack (`gstJersey`).** An isolated module/object holding: the treatment list (standard-rated, zero-rated, exempt, outside-scope/ISE — see §5 for the data), a `treatment → Xero tax-rate name` map (org-specific names, user-supplied), a `version` string, and a `source` reference per entry. Fallback for any unmapped treatment is `'No VAT'` (the safe Xero default that always exists) — never a guessed rate.
2. **Per-line GST treatment in the coding modal.** Each `codingLine` gains a `gstTreatment` field. Source it **deterministically**: from treatment memory (keyed by `normKey`), else a default by nominal code from the rule-pack, else unset. The user **confirms or corrects** each line's treatment — exactly like the code. **Never auto-applied as fact; never LLM-inferred.** Friction switches (auto-confirm remembered treatment) may cut clicks but **cannot turn the per-line gate off** (G6 / Pathway 2 non-negotiable).
3. **On confirm/export (`exportP2`):** write the confirmed treatment to treatment memory (compounds across periods, like coding memory); set `t.gstTreatment` on the coded line.
4. **Xero precoded export:** replace the hard-coded `tax` value in `buildXeroPrecoded` with `gstJersey.xeroName(t.gstTreatment) || 'No VAT'`. One region change. The treatment→name lookup lives in the rule-pack, not in the builder.
5. **QBO:** QBO bank-CSV import does not apply tax codes (same boundary as nominal codes — reference-only). If a treatment column is shown for QBO at all, it is **reference-only**; do not imply QBO applies it. (Mirror the existing `_CODED_REF` reference-only rule.)

---

## 4. Rate-maintenance discipline (build these in — they are the liability control)

Module A records a **regulated treatment** a person relies on. A stale rate is a silent, back-dated, compounding error. Three mechanisms, all in the rule-pack:

- **Official-source-only.** Every treatment entry carries a `source` reference (Revenue Jersey). No blogs/aggregators. The reference rides into the audit workbook.
- **Rate-version banner** on every Pathway-2 run showing the active rule-pack `version` and effective date.
- **Stale-rate hard-stop.** If the rule-pack is expired or marked unverified, the precoded export is **blocked** (consistent with — and separate from — the reconciliation gate). A "what changed" diff shows on version update. This makes the silent compounding error structurally hard to commit; it is stronger than a disclaimer.

**Law-vs-client-facts split (state in the UI copy):** sourcing/encoding the official treatments is the product's job (done once, centrally — this is what a retainer buys). *Which* treatment applies to a given client/transaction (ISE status, exempt vs zero) is the **user's** call — that's what the per-line confirmation captures. The product proposes; the user decides.

---

## 5. The GST data — Stephen sources it; do NOT hard-code from memory

`REASONED (unconfirmed) — verify at source before building.` The treatment *shape* (per the CI brief) is: standard-rated, zero-rated, exempt, outside-scope/ISE. The actual **standard rate value, the category boundaries, and the Xero tax-rate names** are rule-pack **data**, supplied by Stephen from **Revenue Jersey** and the client's own **Xero tax setup** — not constants written by Claude Code or carried from memory. Enter them with `source` + `version` + effective date. This is deliberate: it's the only way the stale-rate hard-stop has meaning.

---

## 6. DECISION NEEDED from Stephen (collect before coding)

1. **The rule-pack data** (§5): treatment list, standard rate + effective date, the `treatment → Xero tax-rate name` map (from the target Xero org), and the official source reference for each. **Verify at source.**
2. **Default treatment** when memory and code-default both miss — `outside-scope`, `No VAT` fallback, or force the user to pick? (Recommend: force a pick — no silent default on a tax field.)
3. **UI placement:** GST column in the coding modal only (recommended), or also read-only in the main review table?
4. **QBO:** show a reference-only treatment column, or omit entirely for QBO statements?

---

## 7. Non-negotiables preserved (verify.sh stays green)

Human approval gate is the only path to any export; the Pathway-2 per-line coding gate stays (now also per-line **treatment** confirm); model transcribes, deterministic code does arithmetic (GST treatment is **not** arithmetic and **not** model-inferred); robust JSON extractor, no prefill; foreign-tx rule; UTF-8 BOM; DD/MM/YYYY; one general rule per account type (the rule-pack is per-jurisdiction data, not a per-bank prompt); model `claude-sonnet-4-6`; API key server-side only; never persist real personal bank details. **Compliance:** build and validate on synthetic / Stephen's own / Xero demo-company data only. Before Module A touches a real client's books, consult the Compliance & Data-Protection adviser (go-live gate). Module A **prepares, never files** — it writes a Tax Rate into an export the user reviews and imports; it never remits or files a GST return (that's Module C, not built).

---

## 8. Verify in the running app (not just compile)

- Code a Pathway-2 Xero statement: each line's treatment is a **proposal** until confirmed; an unconfirmed line cannot export.
- Export the precoded file: the `Tax Rate` column carries the **confirmed treatment's Xero name**, not a blanket `'No VAT'`; an unmapped treatment falls back to `'No VAT'`, not a guess.
- Force an expired/unverified rule-pack: the precoded export is **hard-blocked** with the rate-version banner; reconciliation gate behaviour unchanged.
- Confirm `recalc` / reconciliation are byte-for-byte unaffected (regression-check a known-reconciling statement) — the seam holds.
- `verify.sh` green (incl. the new seam fingerprint); `App.jsx` ↔ mirror still identical; `VERSION` bumped; dated handover + commit (live check named).

---

## 9. Out of scope (do NOT build now)

Module B (payroll journals); Module C (GST return-box map / filing); any **filing** or **remittance**; QBO tax application; auto-applying any treatment without per-line confirm; the engine knowing GST exists; OAuth/push/multi-user. Each waits for its own gate.

---

*Session rules: plan first · one job at a time · minimum change · verify in the running app · separate proof from guess · confirm before any file save · keep the engine GST-clean · never persist real personal bank details.*
