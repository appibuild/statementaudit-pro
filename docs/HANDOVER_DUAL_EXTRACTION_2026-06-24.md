# StatementAudit Pro — Dual-Extraction Engine Handover
**Date:** 2026-06-24
**Build brief:** Dual-Extraction Engine + Format Coverage
**Lines:** 1,861 (both `src/statement-audit-pro.jsx` and `client/src/App.jsx` in sync)
**verify.sh:** 11/11 green

---

## What was built

### Job 1 — Deterministic text-layer extractor (`server/textExtract.js`)

New server-side module. Runs in parallel with the LLM call for every extraction request.

**How it works:**
1. Receives the same base64 PDF that goes to Anthropic
2. Loads via dynamic `import()` of pdfjs-dist v4 (ESM) from the CJS Express server
3. Extracts all text items with x, y coordinates and width from every page
4. Groups items into rows by y-proximity (tolerance: 4 points)
5. Identifies money columns by clustering the **right edges** (tx + width) of money-like items
   - Right edges are used because bank statement amounts are right-aligned — the right edge is constant per column, the left edge varies with text width
   - Gap analysis: clusters of rightX positions with ≥20-point gaps between them = separate columns
   - Rightmost cluster = running balance; next = paid-in (credit); next-left = paid-out (debit)
6. Parses each row: date (left-aligned), description (middle), amounts (right-aligned by column)
7. Accumulates transactions with pending-date logic for multi-line rows

**Returns:** `{ transactions, colCount, source: 'text-layer' }` or `null` (graceful degradation)

**Returns null when:**
- PDF has fewer than 12 text items (scanned/image-based PDF — no text layer)
- Fewer than 3 money-like items found (can't establish column structure)
- Column detection fails to find at least 2 distinct money columns

**What the text extractor does NOT produce:**
- `paymentType` (LLM infers this from the description; text layer has no context)
- `payee` (same — LLM extracts payee from description text; text layer gives raw text only)

**Non-negotiable preserved:** Generalised positional logic only — no per-bank templates, no prompt zoo.

**MONEY_RE pattern:** `^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d{4,8}\.\d{2}$` — first alt handles comma-grouped thousands (real PDFs); second alt handles 4–8 digit amounts without commas (some PDF generators omit commas).

**pdfjs-dist Node.js setup:**
- pdfjs-dist v4 is ESM-only. Loaded via `import('pdfjs-dist/legacy/build/pdf.mjs')` from CJS
- Worker is set to file:// URL: `require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')`
- Empty string for `workerSrc` throws "Setting up fake worker failed" — must use file:// path

---

### Job 2 — Cross-check layer (`server/crossCheck.js`)

Compares LLM transaction list against text-layer list transaction-by-transaction.

**Status values returned:**
- `agree` — same count; all amounts, directions, and balances match within £0.015 tolerance
- `partial` — same count; one or more rows differ (flagged array populated)
- `count_mismatch` — different number of transactions (most serious signal — row dropped or merged)
- `unavailable` — text layer returned null; LLM is the only read

**`flagged` array entries:** `{ index, txId, date, issues: [{ field, llm, text }] }`
- `field` values: `'debit'`, `'credit'`, `'balance'`, `'direction'`
- Direction check only fires when `colCount >= 3` (can determine direction from column position)
- No winner is auto-picked — human reviews flagged rows

**Integration into server/index.js:**
- LLM call and text extraction run in `Promise.all()` — no serial latency added
- LLM response is parsed on the server to extract `transactions[]` for cross-check
- `_textExtract: { available, txCount, colCount, crossCheck }` added to the API response before it is forwarded to the client
- If text extraction fails at any point, `_textExtract.available = false` and the existing LLM path is unaffected

---

### Job 3 — Synthetic fixtures (`tests/synthetic/`)

**Directory structure:**
```
tests/
  synthetic/
    generate.js       ← creates fixture PDFs + expected JSON ground truth (fictional data only)
    run.js            ← test runner; compares detectAndExtract() output against expected
    fixtures/         ← generated PDFs (committed to version control)
    expected/         ← JSON ground truth (committed to version control)
    package.json      ← pdfkit dependency (for fixture generation only)
  real/
    README.md         ← explains real test policy (gitignored — no real data ever committed)
    .gitkeep
```

**Fixtures built:**
- `layout-3col-current.pdf` — Cornwall Bank (fictional), current account, 12 transactions, 3 money columns
- `layout-3col-credit.pdf` — Meridian Card (fictional), credit card, 8 transactions, 3 money columns

**All data is fictional:** invented bank names, payee names, amounts, dates. No real personal data.

**Test runner output:**
```
── StatementAudit Pro — Synthetic fixture tests ──
  PASS  layout-3col-credit
  PASS  layout-3col-current
──────────────────────────────────────────────────
  2 passed  0 failed
```

**VERIFIED LIVE (synthetic ground truth):** Both fixtures pass — column detection correct (colCount=3), transaction count correct, all dates/amounts/directions match within tolerance.

**What synthetic pass means:** column-clustered extraction works on machine-generated PDFs with proper text layers and right-aligned amounts. It does NOT constitute an accuracy claim on real bank statements. Real-statement accuracy is evaluated by uploading own/consented statements cold and reviewing the output by eye.

**To add a new fixture:**
1. Add transaction data and PDF generation code to `generate.js`
2. `node generate.js` — regenerates all PDFs and expected JSONs
3. `node run.js` — all fixtures tested

---

### Client changes (`client/src/App.jsx` and `src/statement-audit-pro.jsx`)

**Statement object:** `crossCheck: null` added to initial shape (set on successful extraction).

**processOne:** `crossCheck: api._textExtract?.crossCheck ?? null` added to `updateS(id, ...)`.

**Reconciliation strip:** Cross-check status shown as a new row below the existing `integrityChecked` note:
- `agree` → blue ⊕ circle + "Dual-path verified — text layer and AI agree on all N transactions"
- `partial` → amber ⊕ + "N transactions where text layer and AI differ — review ⊕ rows below"
- `count_mismatch` → red ⊕ + "AI read N, text layer read M — count mismatch, check for dropped rows"
- `unavailable` → grey text "Text layer: not available for this PDF"
- `null` (no crossCheck data) → nothing shown

**Per-row badge (description cell):** When `crossCheck.status === 'partial'`, a blue ⊕ inline badge appears in the description cell of each flagged transaction showing which fields differ and the two values (AI vs text layer). Tooltip shows full detail. Does not block the approval gate — human reviews and decides.

---

## What was NOT built (and why)

- **Per-bank templates:** non-negotiable per project rules ("one general rule per account type / no prompt zoo"). The column clustering is generalised positional logic only.
- **Auto-winner selection on disagreement:** the human is the gate, not the algorithm.
- **Accuracy claims on real statements:** synthetic fixtures test the extraction machinery; real-statement accuracy requires real testing outside this build.
- **Layer 2 suggestion model:** unchanged — stub only, deferred until real-user signal.

---

## Files changed

| File | Change |
|---|---|
| `server/textExtract.js` | NEW — text-layer extractor |
| `server/crossCheck.js` | NEW — cross-check comparator |
| `server/index.js` | Modified — parallel paths, augmented response |
| `server/package.json` | pdfjs-dist added as dependency |
| `client/src/App.jsx` | crossCheck stored + reconciliation strip + per-row badge |
| `src/statement-audit-pro.jsx` | Same changes mirrored (canonical reference) |
| `VERSION` | expected_lines updated 1824 → 1861 |
| `.gitignore` | tests/real/ added |
| `tests/synthetic/generate.js` | NEW — fixture generator |
| `tests/synthetic/run.js` | NEW — test runner |
| `tests/synthetic/fixtures/*.pdf` | NEW — synthetic fixtures (committed) |
| `tests/synthetic/expected/*.json` | NEW — ground truth (committed) |
| `tests/synthetic/package.json` | NEW — pdfkit dependency |
| `tests/real/README.md` | NEW — policy note (gitignored dir) |

---

## Resume protocol

```
cd statementaudit-pro
bash verify.sh            # expect 11/11 green
cd tests/synthetic && node run.js   # expect 2 passed 0 failed
```

Then load this handover and `src/statement-audit-pro.jsx`.
