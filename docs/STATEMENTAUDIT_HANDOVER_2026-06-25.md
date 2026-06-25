# StatementAudit Pro — Handover 2026-06-25
**Build:** commit `b6c7ce9` + y-creep fix (staged, not yet committed)
**verify.sh:** 11/11 green · Synthetic tests: 2/2 pass · Lines: 1,861

---

## Resume protocol

```
cd statementaudit-pro
bash verify.sh                         # must be 11/11 green
cd tests/synthetic && node run.js      # must be 2 passed 0 failed
```

Then load this file + `src/statement-audit-pro.jsx`.

---

## What happened today

### Test session — 7 real PDFs uploaded to Render

Two PDFs were noise, not code failures:

| PDF | What it was | Render log | Action |
|---|---|---|---|
| Bank of Scotland | Cover/fee page only (page 2 of 5) — no transactions | `null: column clustering found 0 cluster(s) from 4 money items` | Upload all 5 pages next time |
| Alicia Black | TemplateLAB placeholder — £0.00 / £00.00 / sort code 00-00-00 | LLM reads zeros correctly; text layer null | Not a real statement |

Five real statements:

| Statement | AI txns | Text txns | Status |
|---|---|---|---|
| Virgo — Nationwide FlexAccount Oct 2024 | 21 | 7 | ROOT CAUSE found + fix applied (see below) |
| Mansi — Nationwide FlexOne 6-page | 134 | unclear | Effective Date SKIP_RE fix deployed (233e44f); LLM has sign errors |
| Barclays Angeli May 2025 | 7 | 8 | Text over-reads by 1 (unresolved) |
| Barclays Tejada Jul 2025 | 7 | 8 | Same (unresolved) |
| Barclays Hajnat Jan 2023 | 35 | 35 | Reconciles — "Everything adds up" |

---

## Fix applied today — y-creep in groupIntoRows()

**File:** `server/textExtract.js` line 151

**Root cause:** `groupIntoRows()` compared each new item's y against the **last item** in the current row. Nationwide FlexAccount transaction lines within a date group are ~2–4 PDF points apart vertically. Each successive line is within tolerance of the previous → all lines in a date group merged into one row → `parseRow()` saw multiple amounts but kept only the last → 1 transaction emitted per date group × 7 dates = text=7.

**Evidence:** Render log showed `rows=27` for a 21-transaction 1-page statement. Expected ~38 rows without merging. ~11 rows were being collapsed.

**Fix (one line):**
```javascript
// Before (buggy — y-creep allowed):
if (Math.abs(sorted[i].y - current[current.length - 1].y) <= tolerance)

// After (fixed — compares against first item = stable anchor):
if (Math.abs(sorted[i].y - current[0].y) <= tolerance)
```

**Status:** Applied. verify.sh 11/11 green. Synthetic 2/2 pass. **NOT YET COMMITTED OR DEPLOYED.**

**To complete:**
```bash
git add server/textExtract.js
git commit -m "fix: anchor groupIntoRows to first-item y to prevent row-merge creep"
# push → triggers Render deploy → re-upload Virgo → expect text=21 (or closer to 21)
```

---

## Known remaining issues (not fixed today)

### 1. Virgo colCount=2 — direction loss
Even after y-creep fix, Virgo shows `colCount=2`. The Nationwide FlexAccount £ Out and £ In column right-edges are within 20 points of each other → they merge into one cluster. `findMoneyColumns()` returns `credit=null, debit=null`. The 2-column fallback assigns ALL non-balance amounts as debit. Credits (transfers in) will be misclassified as debits.

**Consequence:** Running balance arithmetic wrong → reconciliation variance in the ⊕ strip. Human must sign-flip affected rows.

**To investigate after y-creep fix:** check Render log after re-upload — if colCount rises to 3 (because y-fix now separates amounts into proper rows and column detection sees more distinct right-edges), the problem may resolve itself. If still colCount=2, need to widen column gap detection for 3-column statements.

### 2. Barclays Angeli / Tejada text=8/AI=7
Text layer over-reads by 1. Likely cause: Barclays statements have an "At a glance" summary box on page 1 whose amounts create a spurious cluster (Render log shows colCount=4 for these 7-transaction statements). The extra transaction is probably a "Start balance" or "End balance" row being parsed.

**Next step:** Add a more targeted SKIP_RE match for Barclays balance header rows, OR add a check for the spurious 4th cluster from the summary box.

**Non-urgency:** The ⊕ badge shows `count_mismatch` clearly; human can resolve. Not blocking.

### 3. Mansi LLM sign errors
LLM misclassifies `TRAINLINE.COM LONDON 54.10` as debit (it appears in the £ In column — a credit refund). This is semantic bias from the merchant name. **Cannot fix via prompt** without violating the no-per-bank-prompt rule.

**Correct path:** Human uses ⊕ sign-flip badge. Total variance is £7,092.90 across 134 transactions (approximately 66+ sign reversals). Tedious but within design intent.

**Possible improvement (within rules):** Strengthen the general system prompt hint about £ In = credit (already present but LLM is overriding it by semantic inference). Would need careful wording to avoid becoming merchant-specific.

### 4. Catherine Sharp £5.20 variance
Small statement (12 transactions, colCount=2 YourFlexAccount). Variance not yet investigated. May be opening balance issue similar to Virgo.

---

## Compliance gate — still PENDING

Per COMPLIANCE_ASSESSMENT_2026-06-24.md:
- JOIC registration (~£70) — Stephen to self-regulate per ICA qualification
- Render DPA — sign before processing external customer data
- Anthropic DPF — review and confirm
- Privacy Policy — draft required
- Customer DPA — draft required
- RoPA — draft required

**No external customers until compliance gate closed.**

---

## Next session priorities

1. **Commit y-creep fix** (staged, verified green)
2. **Deploy to Render + re-upload Virgo** — confirm text count rises toward 21
3. **Check if colCount rises to 3** for Virgo after y-fix (may self-resolve the direction issue)
4. **Upload complete Bank of Scotland statement** (all 5 pages) — test a new format
5. **Investigate Catherine Sharp £5.20 variance**
6. **Barclays extra-transaction bug** — only if Virgo confirms y-fix worked

---

## Architecture quick-ref

```
server/
  index.js          Express proxy — runs LLM + text layer in Promise.all()
  textExtract.js    pdfjs-dist text layer extractor (this session's work)
  crossCheck.js     Compares LLM vs text-layer; returns agree/partial/count_mismatch/unavailable
client/src/
  App.jsx           Main UI — dual-path badge, per-row ⊕, human approval gate, CSV export
src/
  statement-audit-pro.jsx   Canonical artifact mirror (kept in sync with App.jsx)
tests/
  synthetic/        2 fixture PDFs + expected JSON; run with node run.js
  real/             Gitignored — own/consented statements only, never committed
verify.sh           11-check source-of-truth gate; run before every commit
```

**Non-negotiables (checked by verify.sh):**
- Model: `claude-sonnet-4-6`, `max_tokens: 32000`
- No assistant prefill
- Robust JSON extractor (indexOf/lastIndexOf)
- UTF-8 BOM on CSV export
- Human-click approval gate — only path to CSV
- API key server-side only (never reaches client)
- Deterministic code does arithmetic (no LLM arithmetic)
- One general rule per account type (no per-bank prompt library)
- No real statements committed to git (.gitignore enforced)
