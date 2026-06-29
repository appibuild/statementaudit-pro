// StatementAudit Pro — canonical build. Last updated: 2026-06-23 (remove dead renderDash; single duplicate-alert definition in renderAudit)
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as XLSX from 'xlsx';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:'#EEF2F7', surf:'#F6F9FC', card:'#FFFFFF', cardHov:'#F2F6FB',
  bdr:'#E3E8EF', bdrBrt:'#D3DBE6',
  grn:'#0FA968', grnDim:'#E6F7EF', grnBrd:'#BCE6D2',
  amb:'#D9870B', ambDim:'#FCF3E1', ambBrd:'#F2D79E',
  red:'#DC4646', redDim:'#FBEBEB', redBrd:'#F1C5C5',
  blu:'#2D6FF0', bluDim:'#EAF1FE', bluBrd:'#C2D8FB',
  pur:'#7A5AF0', purDim:'#EEEAFD', purBrd:'#D2C7F7',
  t1:'#0F1B2D', t2:'#475467', t3:'#7B8698', t4:'#C8D0DC',
};

// ── Trial / demo mode ────────────────────────────────────────────────────────
// Activate by setting these env vars in Render (no source edit required):
//   VITE_TRIAL_MODE=true
//   VITE_TRIAL_LIMIT=3          (optional, default 3)
//   VITE_TRIAL_ACCESS_CODE=XXX  (optional — gates the app behind a code)
// Owner reset: visit ?reset=<your-access-code> to clear the trial counter.
const TRIAL_MODE  = import.meta.env.VITE_TRIAL_MODE  === 'true';
const TRIAL_LIMIT = Math.max(1, parseInt(import.meta.env.VITE_TRIAL_LIMIT  || '3', 10));
const TRIAL_CODE  = (import.meta.env.VITE_TRIAL_ACCESS_CODE || '').trim();

const ACCOUNT_TYPES = {
  current: { label:'Current Account', color:C.blu, types:['DD','BP','SO','VIS','CR','TFR','CHQ','FEE'] },
  savings: { label:'Savings Account',  color:C.grn, types:['DEP','WDR','INT','TFR','NOT','BON','FEE'] },
  credit:  { label:'Credit Card',      color:C.amb, types:['PUR','REF','PMT','INT','FEE','ADV','TFR'] },
  loan:    { label:'Loan / Mortgage',  color:C.pur, types:['PMT','CAP','INT','FEE','OVP','CHG'] },
};

const TYPE_COL = {
  DD:C.red, BP:C.amb, SO:C.blu, VIS:C.t1, CR:C.grn, TFR:C.pur, CHQ:C.t2, FEE:C.red,
  DEP:C.grn, WDR:C.red, INT:C.grn, NOT:C.amb, BON:C.grn,
  PUR:C.red, REF:C.grn, PMT:C.grn, ADV:C.red,
  CAP:C.grn, OVP:C.grn, CHG:C.red,
};

const STATUS_CFG = {
  queued:     { label:'Queued',     color:C.t2  },
  processing: { label:'Processing', color:C.amb },
  review:     { label:'For Review', color:C.blu },
  approved:   { label:'Approved',   color:C.grn },
  rejected:   { label:'Rejected',   color:C.red },
  error:      { label:'Error',      color:C.red },
};

// ─── Jersey GST Rule-Pack ─────────────────────────────────────────────────────
// SEAM GUARD: consulted ONLY by (a) coding modal GST column and (b) buildXeroPrecoded.
// MUST NOT appear inside recalc, the balance walk, reconciliation, or BASE_PROMPT.
const gstJersey = (() => {
  const treatments = [
    { key:'standard', label:'Standard Rate (5%)',     xeroName:'GST on Income',  xeroNameExpense:'GST on Expenses', lawRef:'GST (Jersey) Law 2007 — standard-rated catch-all; Xero: GST on Income (credits) / GST on Expenses (debits)' },
    { key:'zero',     label:'Zero Rated (0%)',         xeroName:'Zero Rated',     lawRef:'Schedule 6 — zero-rated (exports, housing, prescriptions, international services)' },
    { key:'exempt',   label:'Exempt',                  xeroName:'Exempt',         lawRef:'Schedule 5 — exempt (financial services, insurance, postal, medical, charity, education)' },
    { key:'ise',      label:'ISE Supply (>£1,000)',    xeroName:'Zero Rated',     lawRef:'ISE regime — supply to International Service Entity exceeding £1,000, treated as export' },
    { key:'outside',  label:'Outside Scope / No GST', xeroName:'No GST',         lawRef:'Place of supply outside Jersey — not within scope of GST (Jersey) Law 2007' },
  ];
  return {
    version:      '2026-06-29',
    effectiveDate:'2008-05-06',
    verifiedAt:   '2026-06-29',
    source:       'Revenue Jersey · gov.je/TaxesMoney/GST/ · Goods and Services Tax (Jersey) Law 2007, Schedules 5 & 6',
    treatments,
    options:      treatments.map(t => ({ value: t.key, label: t.label })),
    xeroName(key)    { const t = treatments.find(x => x.key === key); return t ? t.xeroName : null; },
    isExpired()      { return (Date.now() - new Date(this.verifiedAt).getTime()) > 365 * 24 * 60 * 60 * 1000; },
  };
})();

// ─── UK VAT Rule-Pack ─────────────────────────────────────────────────────────
// SEAM GUARD: consulted ONLY by (a) coding modal Tax column and (b) buildXeroPrecoded.
// MUST NOT appear inside recalc, the balance walk, reconciliation, or BASE_PROMPT.
const vatUK = (() => {
  const treatments = [
    { key:'standard20', label:'Standard Rate (20%)',   xeroName:'20% (VAT on Income)',  xeroNameExpense:'20% (VAT on Expenses)',  lawRef:'VATA 1994 s.2 — standard-rated supplies; Xero: 20% (VAT on Income) for credits / 20% (VAT on Expenses) for debits' },
    { key:'reduced5',   label:'Reduced Rate (5%)',     xeroName:'5% (VAT on Income)',   xeroNameExpense:'5% (VAT on Expenses)',   lawRef:'VATA 1994 s.29A — reduced rate (domestic energy, certain building works, children\'s car seats)' },
    { key:'zero',       label:'Zero Rated (0%)',        xeroName:'Zero Rated Income',    xeroNameExpense:'Zero Rated Expenses',    lawRef:'VATA 1994 s.30 — zero-rated supplies (food, books, children\'s clothing, public transport, exports)' },
    { key:'exempt',     label:'Exempt',                 xeroName:'Exempt Income',        xeroNameExpense:'Exempt Expenses',        lawRef:'VATA 1994 Sch.9 — exempt supplies (financial services, insurance, land/property, education, health)' },
    { key:'outside',    label:'Outside Scope / No VAT', xeroName:'No VAT',               lawRef:'Outside the scope of UK VAT — wages, dividends, transfers between own accounts' },
  ];
  return {
    version:      '2026-06-29',
    effectiveDate:'2011-01-04',
    verifiedAt:   '2026-06-29',
    source:       'HMRC · gov.uk/guidance/rates-of-vat-on-different-goods-and-services · Value Added Tax Act 1994',
    treatments,
    options:      treatments.map(t => ({ value: t.key, label: t.label })),
    xeroName(key)    { const t = treatments.find(x => x.key === key); return t ? t.xeroName : null; },
    xeroNameExp(key) { const t = treatments.find(x => x.key === key); return t ? (t.xeroNameExpense || t.xeroName) : null; },
    isExpired()      { return (Date.now() - new Date(this.verifiedAt).getTime()) > 365 * 24 * 60 * 60 * 1000; },
  };
})();

// ─── System Prompts ───────────────────────────────────────────────────────────
const BASE_PROMPT = `Return ONLY valid JSON — no markdown fences, no preamble, just raw JSON.

Structure:
{
  "bankName": "string",
  "accountName": "string",
  "period": {"from":"DD/MM/YYYY","to":"DD/MM/YYYY"},
  "openingBalance": 0.00,
  "closingBalance": 0.00,
  "transactions": [
    {"id":1,"date":"DD/MM/YYYY","paymentType":"DD","description":"clean text","payee":"payee name","debit":123.45,"credit":null,"balance":null,"wrapped":false,"ambiguous":false}
  ],
  "reconciliation": {
    "statementPaymentsOut":0.00,"statementPaymentsIn":0.00,
    "csvDebitTotal":0.00,"csvCreditTotal":0.00,"transactionCount":0,
    "openingBalance":0.00,"closingBalance":0.00,"calculatedClosing":0.00,
    "reconciled":true,"variance":0.00,"notes":""
  }
}

Rules:
- Date format DD/MM/YYYY only. Preserve original transaction order.
- Money out = debit (positive), credit = null. Money in = credit (positive), debit = null.
- Strip payment type prefixes from descriptions (e.g. "DD WATER RATES" → "WATER RATES").
- Reconstruct multi-line wrapped transactions into single rows. Never split or merge incorrectly. (This means joining the several printed lines that make up ONE transaction — it does NOT mean combining two separate transactions.)
- Set "wrapped" to true for any transaction you rebuilt from two or more lines on the statement; otherwise false.
- COMPLETENESS — transcribe EVERY transaction printed on the statement, in order, as one row each. The app reconciles by totalling these rows, so a single dropped or merged line breaks the whole statement.
- Two transactions printed as separate entries are SEPARATE, even when they share the same date, merchant, and amount. NEVER deduplicate, combine, or skip one as a presumed repeat. A different reference number (e.g. "INT'L 0054831001" vs "INT'L 0054831002") always means two distinct transactions — output both. Judging whether a same-day repeat is genuine is the app's and the reviewer's job, never yours: transcribe both, and only if you are unsure they are real set "ambiguous":true.
- Page breaks never end or merge a transaction. "BALANCE CARRIED FORWARD" / "BALANCE BROUGHT FORWARD" lines and repeated page headers and footers are layout only — exclude them as label rows (see below), but keep every real transaction on both sides of them. A transaction at the foot of one page and a similar one at the top of the next are both real; do not collapse them into one.
- Set "ambiguous" to true when you are not confident about a transaction's payment type, payee, amount, or whether it is money in or out; otherwise false. Do not guess silently — mark it.
- "balance": the running balance printed against this row, copied EXACTLY as printed, as a SIGNED number (negative if overdrawn, per the overdrawn rules below). If no balance is printed on this row (e.g. several transactions on one day share a single end-of-day balance), set "balance" to null. Do NOT calculate or infer balances yourself — only transcribe the figure shown. This column lets the app verify that no transaction was missed.
- Include: bank charges, fees, interest, penalties. Exclude: page headers/footers, balance label rows, pure exchange-rate text with no GBP transaction value.
- csvDebitTotal = exact sum of all debit values. csvCreditTotal = exact sum of all credit values.
- openingBalance and closingBalance: read these from the Account Summary section as printed. Be aware that some statements print a summary "Balance on [start date]" that already includes that day's first transaction rather than the true brought-forward opening. Return the summary figure exactly as you read it, and rely on the per-row "balance" column above — the app cross-checks the two and corrects the opening if needed. Do NOT adjust the opening balance yourself.
- reconciled = true only when CSV totals match statement totals AND calculatedClosing matches closingBalance, both within £0.01.`;

const PROMPTS = {
  current: `You process UK CURRENT ACCOUNT bank statements for QuickBooks Online and Xero import. ${BASE_PROMPT}

Payment types: DD (direct debit), BP (BACS/bill payment), SO (standing order), VIS (Visa/card/contactless), CR (incoming BACS credit), TFR (bank transfer), CHQ (cheque), FEE (bank charge or fee).
NEVER skip lines with "@" or "Visa Rate" — these are real foreign card transactions. Classify as VIS and retain the GBP debit amount.
Overdrawn balances: UK banks mark an overdrawn (negative) balance with "D", "DR", "OD" or "Overdrawn" (e.g. "339.16 D" means the account is £339.16 overdrawn). A balance in credit is marked "CR"/"C" or left unmarked. Return openingBalance and closingBalance as SIGNED numbers — negative when overdrawn, positive when in credit. Example: opening "339.16 D" → -339.16; closing "31.14" → 31.14.
calculatedClosing = openingBalance + csvCreditTotal - csvDebitTotal.
Direction is determined SOLELY by which money column the amount appears in. The left money column ("Paid out") is always money out (debit). The right money column ("Paid in") is always money in (credit). NEVER infer direction from the payment-type code: the same code (DD, BP, SO, TFR, CR, VIS, etc.) can appear in EITHER column. A "BP" or "TFR" amount in the Paid-in column is money IN (a refund, gift, or reversal); the same code in the Paid-out column is money OUT. When a row's code suggests one direction but the amount sits in the other column, the COLUMN wins.`,

  savings: `You process UK SAVINGS ACCOUNT statements for QuickBooks Online and Xero import. ${BASE_PROMPT}

Payment types: DEP (deposit/payment in), WDR (withdrawal), INT (interest credited), TFR (transfer in or out), NOT (notice period withdrawal), BON (bonus interest), FEE (account fee).
Interest is almost always a credit, and withdrawals are almost always debits — but if the amount appears in the other column, the COLUMN always has final say.
Overdrawn balances: a balance marked "D"/"DR"/"OD"/"Overdrawn" is negative; "CR"/"C" or unmarked is positive. Return openingBalance and closingBalance as SIGNED numbers (negative when overdrawn).
calculatedClosing = openingBalance + csvCreditTotal - csvDebitTotal.
Direction is determined SOLELY by which money column the amount appears in. The left money column ("Paid out") is always money out (debit). The right money column ("Paid in") is always money in (credit). NEVER infer direction from the payment-type code: the same code (DD, BP, SO, TFR, CR, VIS, etc.) can appear in EITHER column. A "BP" or "TFR" amount in the Paid-in column is money IN (a refund, gift, or reversal); the same code in the Paid-out column is money OUT. When a row's code suggests one direction but the amount sits in the other column, the COLUMN wins.`,

  credit: `You process UK CREDIT CARD statements for QuickBooks Online and Xero import. ${BASE_PROMPT}

Payment types: PUR (purchase = debit, balance increases), REF (merchant refund = credit, balance decreases), PMT (payment to card = credit, balance decreases), INT (interest charged = debit), FEE (annual/late/over-limit fee = debit), ADV (cash advance = debit), TFR (balance transfer).
Credit card logic: spending increases the balance owed, payments reduce it.
Account Summary balances: the opening ("Previous Balance") and closing ("New Balance") may carry a credit marker — "CR" or "C", or a trailing minus (e.g. "6.04CR", "6.04 CR", "6.04-"). On a credit card the balance is what you OWE, so a credit-marked balance means the cardholder is in credit (overpaid) and MUST be returned as a NEGATIVE number. A balance with no marker, or a "DR"/"D" marker, is a normal balance owed — return it POSITIVE. Read these from the Account Summary as printed; do not calculate. Example: "Previous Balance 6.04CR" → openingBalance: -6.04. (This applies ONLY to the summary balances; transaction-row credit markers are handled by the payment types above.)
calculatedClosing = openingBalance + csvDebitTotal - csvCreditTotal.`,

  loan: `You process UK LOAN AND MORTGAGE statements for QuickBooks Online and Xero import. ${BASE_PROMPT}

Payment types: PMT (monthly payment received = credit, reduces outstanding), CAP (capital repaid = credit), INT (interest charged = debit, increases balance), FEE (arrangement or admin fee = debit), OVP (overpayment = credit), CHG (penalty or default charge = debit).
openingBalance = outstanding loan amount at period start. closingBalance = outstanding loan amount at period end.
Account Summary balances: the opening and closing outstanding balances may carry a credit marker — "CR" or "C", or a trailing minus. A credit-marked balance means the account is overpaid/in credit and MUST be returned as a NEGATIVE number; an unmarked or "DR"/"D" balance is a normal outstanding amount — return it POSITIVE. Read as printed; do not calculate. (This applies ONLY to the summary balances; transaction-row credit markers are handled by the payment types above.)
Where the statement shows capital and interest as separate line items, preserve them as separate rows.
calculatedClosing = openingBalance + csvDebitTotal - csvCreditTotal.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

const toBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload  = () => res(r.result.split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

const fmtCcy = n => n == null ? '—' : `£${Math.abs(+n).toFixed(2).replace(/\B(?=(\d{3})+\b)/g, ',')}`;
const fmtBal = n => n == null ? '—' : (+n < 0 ? '−' : '') + fmtCcy(n);
const fmtN   = n => n == null ? '' : (+n).toFixed(2);
const pDate  = str => { if (!str) return 0; const [d,m,y] = str.split('/'); return new Date(+y,+m-1,+d).getTime(); };

// Detect FX transactions from description/payee text.
// Returns {currency} for display badge, or null if no foreign currency found.
const FX_CCY = /\b(USD|EUR|AUD|CAD|JPY|CHF|NOK|SEK|DKK|NZD|HKD|SGD|ZAR|MXN|BRL|INR|CNY|TRY|AED|SAR)\b/i;
const detectFX = desc => {
  if (!desc) return null;
  const m = desc.match(FX_CCY);
  return m ? { currency: m[1].toUpperCase() } : null;
};

// Convert DD/MM/YYYY to YYYY-MM-DD for frankfurter.app API
const txDateToISO = ddmmyyyy => {
  if (!ddmmyyyy) return null;
  const [d,m,y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
};

const recalc = (txList, prev, acType) => {
  const deb = +txList.reduce((s,t) => s + (t.debit  || 0), 0).toFixed(2);
  const crd = +txList.reduce((s,t) => s + (t.credit || 0), 0).toFixed(2);
  const stOut  = prev?.statementPaymentsOut || 0;
  const stIn   = prev?.statementPaymentsIn  || 0;
  const open   = prev?.openingBalance ?? null;
  const close  = prev?.closingBalance ?? null;
  let calc = null;
  if (open != null) calc = acType === 'loan' || acType === 'credit'
    ? +(open + deb - crd).toFixed(2)
    : +(open + crd - deb).toFixed(2);
  const txVar  = +(Math.abs(deb - stOut) + Math.abs(crd - stIn)).toFixed(2);
  const balVar = (close != null && calc != null) ? +Math.abs(close - calc).toFixed(2) : 0;
  const variance = +(txVar + balVar).toFixed(2);
  // Work the opening balance backwards from the closing balance + this period's movement.
  // Useful when a bank (e.g. Lloyds) prints "Balance on day 1" — which already includes
  // that day's transactions — instead of a true brought-forward opening.
  const derivedOpening = close != null
    ? (acType === 'loan' || acType === 'credit'
        ? +(close - deb + crd).toFixed(2)
        : +(close - crd + deb).toFixed(2))
    : null;
  // Would the OTHER polarity (credit-positive vs debit-positive) reconcile? If so, the
  // account TYPE is probably wrong — not the opening. e.g. a credit card processed as a
  // current account. We suggest switching the type rather than a bogus opening balance.
  const flippedCalc = open != null
    ? (acType === 'loan' || acType === 'credit'
        ? +(open + crd - deb).toFixed(2)
        : +(open + deb - crd).toFixed(2))
    : null;
  const flippedVar = (close != null && flippedCalc != null) ? +Math.abs(close - flippedCalc).toFixed(2) : null;
  const accountTypeLikelyWrong = close != null && txVar < 0.02 && balVar >= 0.02
    && flippedVar != null && flippedVar < 0.02;
  const suggestedType = accountTypeLikelyWrong
    ? ((acType === 'loan' || acType === 'credit') ? 'current' : 'credit')
    : null;
  // Only flag an opening misread when the transactions already match the statement's own
  // totals, the balance doesn't, AND it's not actually a wrong-account-type situation.
  const openingLikelyOff = open != null && close != null && txVar < 0.02 && balVar >= 0.02
    && !accountTypeLikelyWrong
    && derivedOpening != null && Math.abs(derivedOpening - open) >= 0.02;
  // ── Running-balance integrity (uses the per-row printed balances the model transcribes) ──
  // Two deterministic jobs from the printed Balance column, no model arithmetic:
  //  (1) derive the TRUE opening from the first printed balance (top-down) — a second
  //      independent anchor to the closing-end derivation above; and
  //  (2) walk consecutive printed balances and flag any segment where the transactions
  //      between them don't account for the change — i.e. a row was dropped or its
  //      direction flipped. Bank-agnostic. Gracefully does nothing if no balances present.
  const creditPos = !(acType === 'loan' || acType === 'credit');
  const mv = t => creditPos ? ((t.credit||0) - (t.debit||0)) : ((t.debit||0) - (t.credit||0)); // signed move on the balance
  const idxFirstBal = txList.findIndex(t => t.balance != null);
  let trueOpeningFromTop = null;
  const balanceBreaks = [];
  const flipSuggestions = [];
  // Pinpoint the single transaction whose 2×amount matches |gap| — the likely sign-flip.
  // gap>0 in credit-positive → a debit that should be credit; gap<0 → credit that should be debit.
  // Inverted for debit-positive (credit/loan) accounts. Returns null if not uniquely identified.
  const findFlip = (spanTxs, gap, fromDate, toDate) => {
    const halfGap = +(Math.abs(gap) / 2).toFixed(2);
    const toCredit = creditPos ? gap > 0 : gap < 0;
    const cands = spanTxs.filter(t =>
      toCredit ? Math.abs((t.debit  || 0) - halfGap) < 0.01
               : Math.abs((t.credit || 0) - halfGap) < 0.01
    );
    if (cands.length !== 1) return null;
    return {
      tid: cands[0].id, amount: halfGap, toCredit, date: cands[0].date, fromDate, toDate,
      msg: creditPos
        ? (toCredit
            ? `This looks like money IN — your statement shows this amount in the Paid-in column. Change to credit?`
            : `This looks like money OUT — your statement shows this amount in the Paid-out column. Change to debit?`)
        : (toCredit
            ? `This looks like a credit (payment or refund) — the printed balance moved in the credit direction. Change to credit?`
            : `This looks like a debit (purchase or charge) — the printed balance moved in the debit direction. Change to debit?`)
    };
  };
  if (idxFirstBal !== -1) {
    // (1) Opening, top-down: first printed balance minus the movement up to & including it.
    let netToFirst = 0;
    for (let i = 0; i <= idxFirstBal; i++) netToFirst += mv(txList[i]);
    trueOpeningFromTop = +(txList[idxFirstBal].balance - netToFirst).toFixed(2);
    // (2) Integrity: between consecutive printed balances the movement must equal the delta.
    let prevIdx = idxFirstBal;
    for (let j = idxFirstBal + 1; j < txList.length; j++) {
      if (txList[j].balance == null) continue;
      let seg = 0;
      for (let k = prevIdx + 1; k <= j; k++) seg += mv(txList[k]);
      const expected = +(txList[prevIdx].balance + seg).toFixed(2);
      const gap = +(txList[j].balance - expected).toFixed(2);
      if (Math.abs(gap) >= 0.01) {
        let brHint = null;
        if (j === prevIdx + 1) {
          // Single-transaction span: the balance delta is direct proof of the correct direction.
          // If actualMv + delta ≈ 0 the recorded direction opposes the balance evidence.
          const delta     = +(txList[j].balance - txList[prevIdx].balance).toFixed(2);
          const actualMv  = mv(txList[j]);
          if (Math.abs(actualMv + delta) < 0.01) {
            const toCredit = creditPos ? delta > 0 : delta < 0;
            const amount   = +(Math.abs(delta)).toFixed(2);
            const sign     = delta > 0 ? `+£${amount.toFixed(2)}` : `−£${amount.toFixed(2)}`;
            const wrong    = toCredit ? 'debit' : 'credit';
            const right    = toCredit ? 'credit' : 'debit';
            flipSuggestions.push({
              tid: txList[j].id, amount, toCredit, date: txList[j].date,
              fromDate: txList[prevIdx].date, toDate: txList[j].date,
              msg: `Balance ${fmtBal(txList[prevIdx].balance)} → ${fmtBal(txList[j].balance)} (${sign}) — recorded as ${wrong}, should be ${right}.`,
            });
          } else {
            // Correct direction but wrong amount, or the printed balance has an OCR error.
            brHint = `Single row — transaction is £${+(Math.abs(actualMv)).toFixed(2)} but balance only moved by £${+(Math.abs(delta)).toFixed(2)}. Check the amount, or whether the printed running balance has an error.`;
          }
        } else {
          const flip = findFlip(txList.slice(prevIdx + 1, j + 1), gap, txList[prevIdx].date, txList[j].date);
          if (flip) flipSuggestions.push(flip);
        }
        balanceBreaks.push({ fromDate: txList[prevIdx].date, toDate: txList[j].date, gap, hint: brHint });
      }
      prevIdx = j;
    }
    // Final leg: last printed balance → statement closing.
    if (close != null) {
      let seg = 0;
      for (let k = prevIdx + 1; k < txList.length; k++) seg += mv(txList[k]);
      const expected = +(txList[prevIdx].balance + seg).toFixed(2);
      const gap = +(close - expected).toFixed(2);
      if (Math.abs(gap) >= 0.01) {
        balanceBreaks.push({ fromDate: txList[prevIdx].date, toDate: 'closing', gap });
        const flip = findFlip(txList.slice(prevIdx + 1), gap, txList[prevIdx].date, 'closing');
        if (flip) flipSuggestions.push(flip);
      }
    }
  }
  // Two independent opening anchors agreeing → trust the true opening, apply without a click.
  const openingAnchorsAgree = trueOpeningFromTop != null && derivedOpening != null
    && Math.abs(trueOpeningFromTop - derivedOpening) < 0.01;

  // #12 — Date ordering: out-of-order dates make the balance walk unreliable.
  const dateOrderWarning = txList.length > 1 &&
    txList.some((t, i) => i > 0 && pDate(t.date) < pDate(txList[i-1].date));

  // #13 — Data quality: no amount, double-entry, or negative value returned by the AI.
  const dataIssues = txList
    .map((t, i) => ({ idx: i, tid: t.id, date: t.date,
      issue: (t.debit == null && t.credit == null) ? 'no-amount'
           : (t.debit != null && t.credit != null) ? 'both-columns'
           : ((t.debit != null && t.debit < 0) || (t.credit != null && t.credit < 0)) ? 'negative-value'
           : null }))
    .filter(x => x.issue != null);

  // #9 — Exact-amount candidate search (no per-row balance column only).
  // When statement-level gaps mirror each other (sign-flip signature), find transactions
  // whose exact amount equals the gap — they are the likely wrong-direction rows.
  const stmtOutGap = +(Math.abs(deb - stOut)).toFixed(2);
  const stmtInGap  = +(Math.abs(crd - stIn)).toFixed(2);
  const mirroredCandidates = (idxFirstBal === -1 && stmtOutGap >= 0.02 && Math.abs(stmtOutGap - stmtInGap) < 0.02)
    ? txList
        .filter(t => (deb > stOut && Math.abs((t.debit  || 0) - stmtOutGap) < 0.01)
                  || (crd > stIn  && Math.abs((t.credit || 0) - stmtOutGap) < 0.01))
        .map(t => t.id)
    : [];

  // Pair-sum search: when no single transaction matches the gap, check if two same-side
  // transactions together account for it (e.g. two £15 debits causing a £30 mirrored variance).
  const pairCandidates = (mirroredCandidates.length === 0 && stmtOutGap >= 0.02
      && Math.abs(stmtOutGap - stmtInGap) < 0.02 && txList.length <= 200)
    ? (() => {
        const side = deb > stOut ? 'debit' : 'credit';
        const pairs = [];
        for (let a = 0; a < txList.length; a++) {
          for (let b = a + 1; b < txList.length; b++) {
            const sa = (side === 'debit' ? txList[a].debit : txList[a].credit) || 0;
            const sb = (side === 'debit' ? txList[b].debit : txList[b].credit) || 0;
            if (sa > 0 && sb > 0 && Math.abs(sa + sb - stmtOutGap) < 0.01)
              pairs.push([txList[a].id, txList[b].id]);
          }
        }
        return pairs;
      })()
    : [];

  // JOB 2 — per-row expected running balance. Single source: same mv() + creditPos as the walk above.
  // Keyed by tx id so the renderer can look up without index arithmetic.
  const expectedBalances = {};
  if (open != null) {
    let running = open;
    for (let k = 0; k < txList.length; k++) {
      running = +(running + mv(txList[k])).toFixed(2);
      expectedBalances[txList[k].id] = running;
    }
  }

  return { ...prev, csvDebitTotal:deb, csvCreditTotal:crd, transactionCount:txList.length,
    calculatedClosing:calc, variance, txVar, balVar, derivedOpening, openingLikelyOff,
    accountTypeLikelyWrong, suggestedType,
    trueOpeningFromTop, openingAnchorsAgree, balanceBreaks, flipSuggestions, integrityChecked: idxFirstBal !== -1,
    reconciled: variance < 0.02,
    dateOrderWarning, dataIssues, mirroredCandidates, pairCandidates, expectedBalances };
};

// Confidence score — a points checklist (NOT a probability). Start at 100 and deduct:
//   −40 variance ≥ £0.02 (not reconciled)
//   −15 no closing balance (maths only half-checked)
//   −10 count mismatch between AI extraction and text layer
//   −10 any balance-walk integrity breaks; −5 per break beyond the first (cap −25 total)
//   −5  date order warning (breaks make the balance walk unreliable)
//   −5  data quality issues (no-amount, both-columns, negative-value rows)
//   −5  ambiguous rows present (also a hard gate in greenLit)
//   Clamped to 0–100.
const calcConfidence = (rec, txList, crossCheck) => {
  if (!rec) return null;
  let score = 100;
  if (!rec.reconciled)                           score -= 40;
  if (rec.closingBalance == null)                score -= 15;
  if (crossCheck?.status === 'count_mismatch')   score -= 10;
  const breaks = rec.balanceBreaks?.length || 0;
  if (breaks > 0) {
    score -= 10;
    score -= Math.min(15, (breaks - 1) * 5);
  }
  if (rec.dateOrderWarning)                      score -= 5;
  if ((rec.dataIssues?.length || 0) > 0)        score -= 5;
  if ((txList || []).some(t => t.ambiguous))     score -= 5;
  return Math.max(0, Math.min(100, score));
};

// Fast-track green light — all four must hold (Option A hard rule on ambiguous lines).
// score>=95 with the new granular formula means: reconciled, closing present, no count mismatch,
// no balance breaks, no date/data issues. Ambiguous rows deduct −5 AND are gated explicitly.
// The duplicate check is passed in live at display time, never baked into the stored score.
const greenLit = (score, rec, txList, hasDupe) =>
  score != null && score >= 95 &&
  !!rec?.reconciled &&
  !(txList || []).some(t => t.ambiguous) &&
  !hasDupe;

const buildQBO = txList => {
  const h = 'Date,Payment Type,Description,Payee,Debit,Credit,Category,Nominal Code,Notes';
  return [h, ...txList.map(t => {
    const d = (t.description||'').replace(/"/g,'""');
    const p = (t.payee||'').replace(/"/g,'""');
    const n = (t.notes||'').replace(/"/g,'""');
    const c = (t.category||'').replace(/"/g,'""');
    return `${t.date},${t.paymentType},"${d}","${p}",${t.debit??''},${t.credit??''},"${c}",${t.nominalCode||''},"${n}"`;
  })].join('\r\n');
};

const buildXero = txList => {
  const h = 'Date,Amount,Payee,Description,Reference,Cheque Number,Analysis Code,Category';
  return [h, ...txList.map(t => {
    const amt = t.credit != null ? t.credit : t.debit != null ? -t.debit : '';
    const p = (t.payee||'').replace(/"/g,'""');
    const d = (t.description||'').replace(/"/g,'""');
    const c = (t.category||'').replace(/"/g,'""');
    return `${t.date},${amt},"${p}","${d}",${t.paymentType},,${t.nominalCode||''},"${c}"`;
  })].join('\r\n');
};

const buildXeroPrecoded = (txList, jurisdiction) => {
  // Tax Rate is mandatory for Xero to recognise the import as precoded (coded + reconciled).
  // Without it Xero silently falls back to plain uncoded statement lines.
  // Tracking1/Tracking2 are optional; included as empty columns for future use.
  const rulePack = jurisdiction === 'jersey' ? gstJersey : jurisdiction === 'uk' ? vatUK : null;
  const h = 'Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking1,Tracking2';
  return [h, ...txList.map(t => {
    const amt  = t.credit != null ? t.credit : t.debit != null ? -t.debit : '';
    const p    = (t.payee||'').replace(/"/g,'""');
    const d    = (t.description||'').replace(/"/g,'""');
    const ref  = (t.paymentType||'');
    const code = (t.nominalCode||'');
    const isDebit = t.debit != null && t.credit == null;
    let tax = '';
    if (rulePack) {
      if (jurisdiction === 'jersey') {
        const gstName = gstJersey.xeroName(t.gstTreatment);
        tax = gstName === 'GST on Income' && isDebit ? 'GST on Expenses' : gstName || (code ? 'No VAT' : '');
      } else if (jurisdiction === 'uk') {
        const vatName = vatUK.xeroName(t.gstTreatment);
        const vatNameExp = vatUK.xeroNameExp(t.gstTreatment);
        tax = isDebit ? (vatNameExp || vatName || (code ? 'No VAT' : '')) : (vatName || (code ? 'No VAT' : ''));
      }
    } else {
      tax = code ? 'No VAT' : '';
    }
    const tr1 = (t.tracking1||'').replace(/"/g,'""');
    const tr2 = (t.tracking2||'').replace(/"/g,'""');
    return `${t.date},${amt},"${p}","${d}",${ref},${code},${tax},"${tr1}","${tr2}"`;
  })].join('\r\n');
};

const buildCSV = s => {
  const tx = s.editedTransactions || s.transactions || [];
  return s.platform === 'xero' ? buildXero(tx) : buildQBO(tx);
};

const makeName = (s, suffix='') => {
  const bank = (s.bankName||'Bank').replace(/\s+/g,'_');
  const plat = (s.platform||'qbo').toUpperCase();
  const sfx  = suffix ? `_${suffix}` : '';
  const pfx  = TRIAL_MODE ? 'TRIAL_' : '';
  if (!s.period?.from) return `${pfx}${bank}_${plat}${sfx}.csv`;
  const d = str => str.split('/').reverse().join('-');
  return `${pfx}${bank}_${d(s.period.from)}_to_${d(s.period.to)}_${plat}${sfx}.csv`;
};

const dlFile = (content, name) => {
  const blob = new Blob(['\uFEFF' + content], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:name });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const buildAuditWorkbook = (s, rec, treatmentLabels = {}) => {
  const tx = s.editedTransactions || s.transactions || [];
  const wb = XLSX.utils.book_new();

  // \u2500\u2500 Sheet 1: Audit Review \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const ar = [];
  ar.push(['Bank', s.bankName||'', 'Account', s.accountName||'']);
  ar.push(['Period', s.period ? `${s.period.from} \u2013 ${s.period.to}` : '', 'Account type', (ACCOUNT_TYPES[s.accountType]||ACCOUNT_TYPES.current).label]);
  ar.push([]);
  const taxColLabel = s.jurisdiction === 'uk' ? 'VAT Treatment' : s.jurisdiction === 'jersey' ? 'GST Treatment' : 'Tax Treatment';
  ar.push(['#','Date','Type','Description','Payee','Debit (out)','Credit (in)','Running balance','Expected balance','Category','Nominal code',taxColLabel,'Notes','Flags','Receipt file']);
  const expBals = rec?.expectedBalances || {};
  tx.forEach((t, i) => {
    const flags = [t.flagged?'\u2691':'', t.ambiguous?'Check':'', t.wrapped?'Joined':''].filter(Boolean).join(', ');
    ar.push([i+1, t.date, t.paymentType, t.description||'', t.payee||'',
      t.debit!=null?t.debit:'', t.credit!=null?t.credit:'',
      t.balance!=null?t.balance:'', expBals[t.id]!=null?expBals[t.id]:'',
      t.category||'', t.nominalCode||'',
      treatmentLabels[((t.payee&&t.payee.trim())||(t.description&&t.description.trim())||'').toUpperCase().replace(/\s+/g,' ')]||'',
      t.notes||'', flags, t.receipt?.filename||'']);
  });
  ar.push([]);
  const stOut  = rec?.statementPaymentsOut || 0;
  const stIn   = rec?.statementPaymentsIn  || 0;
  const csvDeb = rec?.csvDebitTotal  || 0;
  const csvCrd = rec?.csvCreditTotal || 0;
  ar.push(['','','','','CSV totals',         csvDeb||'', csvCrd||'']);
  ar.push(['','','','','Statement figures',   stOut||'',  stIn||'']);
  const outGap = +(Math.abs(csvDeb - stOut)).toFixed(2);
  const inGap  = +(Math.abs(csvCrd - stIn)).toFixed(2);
  ar.push(['','','','','Variance',            outGap||'', inGap||'']);
  ar.push([]);
  ar.push(['Opening balance', rec?.openingBalance??'', 'Closing (statement)', rec?.closingBalance??'']);
  ar.push(['Calculated closing', rec?.calculatedClosing??'', 'Balance variance', rec?.balVar??'']);
  ar.push([]);
  const statusText = rec?.reconciled
    ? 'RECONCILED'
    : `NOT RECONCILED \u2014 variance \u00A3${rec?.variance?.toFixed(2)??'?'}`;
  ar.push(['STATUS', statusText]);
  if (!rec?.reconciled && outGap >= 0.02 && Math.abs(outGap - inGap) < 0.02)
    ar.push(['NOTE', `Equal-and-opposite gap of \u00A3${outGap.toFixed(2)} on both sides \u2014 likely a transaction entered in the wrong direction.`]);

  const ws1 = XLSX.utils.aoa_to_sheet(ar);
  ws1['!cols'] = [{wch:4},{wch:12},{wch:7},{wch:42},{wch:26},{wch:13},{wch:13},{wch:16},{wch:16},{wch:20},{wch:18},{wch:22},{wch:28},{wch:12},{wch:32}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Audit Review');

  // \u2500\u2500 Sheet 2: Import (clean) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const importLabel = s.platform === 'xero' ? 'Xero Import (clean)' : 'QBO Import (clean)';
  const ir = s.platform === 'xero'
    ? [['Date','Amount','Payee','Description','Reference','Cheque Number','Analysis Code'],
       ...tx.map(t => {
         const amt = t.credit!=null ? t.credit : t.debit!=null ? -t.debit : '';
         return [t.date, amt, t.payee||'', t.description||'', t.paymentType, '', t.nominalCode||''];
       })]
    : [['Date','Payment Type','Description','Payee','Debit','Credit','Category','Nominal Code','Notes'],
       ...tx.map(t => [t.date, t.paymentType, t.description||'', t.payee||'', t.debit??'', t.credit??'', t.category||'', t.nominalCode||'', t.notes||''])];
  const ws2 = XLSX.utils.aoa_to_sheet(ir);
  ws2['!cols'] = [{wch:12},{wch:14},{wch:42},{wch:26},{wch:13},{wch:13},{wch:20},{wch:18},{wch:28}];
  XLSX.utils.book_append_sheet(wb, ws2, importLabel);

  // ── Sheet 3: Receipts ──────────────────────────────────────────────────
  const withReceipts = tx.filter(t => t.receipt);
  const rr = [['#','Date','Payee / Description','Debit (out)','Credit (in)','Receipt filename','Note']];
  if (withReceipts.length === 0) {
    rr.push(['','','No receipts were attached this session','','','','']);
  } else {
    withReceipts.forEach((t, i) => {
      rr.push([i+1, t.date, t.payee||t.description||'', t.debit!=null?t.debit:'', t.credit!=null?t.credit:'',
        t.receipt.filename, 'Save the file alongside this workbook using the same name']);
    });
    rr.push([]);
    rr.push(['','','','','','','Receipt files are saved locally — not embedded in QBO/Xero exports.']);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(rr);
  ws3['!cols'] = [{wch:4},{wch:12},{wch:40},{wch:13},{wch:13},{wch:36},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws3, 'Receipts');

  return wb;
};

const fmtTime = ts => {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 60000;
  if (diff < 1)    return 'just now';
  if (diff < 60)   return `${Math.round(diff)}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
};

// ─── PKCE helpers for Xero / QBO OAuth ───────────────────────────────────────
const XERO_CLIENT_ID = import.meta.env.VITE_XERO_CLIENT_ID || '';
const QBO_CLIENT_ID  = import.meta.env.VITE_QBO_CLIENT_ID  || '';

const pkceGenerateVerifier = () => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
};

const pkceChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
};

const startXeroCoaAuth = async () => {
  if (!XERO_CLIENT_ID) return;
  const verifier   = pkceGenerateVerifier();
  const challenge  = await pkceChallenge(verifier);
  sessionStorage.setItem('xero_coa_verifier', verifier);
  const redirect = window.location.origin + window.location.pathname;
  const url = `https://login.xero.com/identity/connect/authorize?` +
    `response_type=code&client_id=${XERO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=accounting.settings.read+offline_access` +
    `&state=xero_coa` +
    `&code_challenge=${challenge}&code_challenge_method=S256`;
  window.location.href = url;
};

const startQboCoaAuth = () => {
  if (!QBO_CLIENT_ID) return;
  const redirect = window.location.origin + window.location.pathname;
  const state = 'qbo_coa_' + Math.random().toString(36).slice(2,8);
  sessionStorage.setItem('qbo_coa_state', state);
  const url = `https://appcenter.intuit.com/connect/oauth2?` +
    `response_type=code&client_id=${QBO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=com.intuit.quickbooks.accounting` +
    `&state=${state}`;
  window.location.href = url;
};

const dlReceipt = (receipt, tx, stmt) => {
  const a = document.createElement('a');
  a.href = receipt.url;
  const ext = receipt.filename.includes('.') ? receipt.filename.split('.').pop() : 'pdf';
  const bank = (stmt.bankName || 'Bank').replace(/[^a-zA-Z0-9]/g,'_');
  const date = (tx.date || '').replace(/\//g,'-');
  const desc = (tx.payee || tx.description || 'receipt').replace(/[^a-zA-Z0-9]/g,'_').slice(0,20);
  a.download = `${bank}_${date}_${desc}_receipt.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const confidenceHint = (score, rec, txList, crossCheck) => {
  if (!score || score >= 95 || !rec) return null;
  if (!rec.reconciled)                         return `Variance £${(rec.variance||0).toFixed(2)}`;
  if (crossCheck?.status === 'count_mismatch') return `Row count gap (${crossCheck.textCount} vs ${crossCheck.llmCount})`;
  if (rec.balanceBreaks?.length)               return `Balance break after ${rec.balanceBreaks[0].fromDate}`;
  if (rec.closingBalance == null)              return 'Closing balance not confirmed';
  if (rec.dateOrderWarning)                    return 'Date order issue';
  if ((rec.dataIssues?.length||0) > 0)         return `${rec.dataIssues.length} data issue${rec.dataIssues.length>1?'s':''}`;
  if ((txList||[]).some(t => t.ambiguous))     return 'Some rows need checking';
  return null;
};

// ── Cloud storage: Google Drive + OneDrive (BYOC) ────────────────────────────
// SETUP REQUIRED before Connect buttons work:
//   Google  → console.cloud.google.com → APIs & Services → Credentials
//             Create OAuth 2.0 Client ID (Web) → add your Render URL as redirect URI
//   OneDrive → portal.azure.com → App registrations → New registration
//             Add redirect URI, grant Files.ReadWrite + User.Read
// Then paste the client IDs into the two empty strings below.
const CLOUD_CFG = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    authUrl:  'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope:    'https://www.googleapis.com/auth/drive.appdata openid email profile',
    label:    'Google Drive',
    color:    '#4285F4',
  },
  microsoft: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
    authUrl:  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    // Files.ReadWrite (not AppFolder) — required for workspace shared folders
    scope:    'Files.ReadWrite User.Read offline_access',
    label:    'OneDrive / M365',
    color:    '#0078D4',
  },
};

const generatePKCE = async () => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return { verifier, challenge };
};

const cloudSaveStmt = async (provider, token, stmt) => {
  const filename = `sa_stmt_${stmt.id}.json`;
  const tx = (stmt.editedTransactions || stmt.transactions || []).map(t =>
    ({...t, receipt: t.receipt ? {filename: t.receipt.filename} : undefined})
  );
  const body = JSON.stringify({...stmt, editedTransactions:tx, transactions:tx, pdfData:undefined, rawResponse:undefined, file:undefined});
  if (provider === 'google') {
    const lst = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${filename}'&fields=files(id)`,
      {headers:{Authorization:`Bearer ${token}`}}
    ).then(r => r.json());
    const fid = lst.files?.[0]?.id;
    const meta = JSON.stringify({name:filename, ...(fid ? {} : {parents:['appDataFolder']})});
    const form = new FormData();
    form.append('metadata', new Blob([meta], {type:'application/json'}));
    form.append('file',     new Blob([body], {type:'application/json'}));
    await fetch(
      fid ? `https://www.googleapis.com/upload/drive/v3/files/${fid}?uploadType=multipart`
          : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
      {method: fid ? 'PATCH' : 'POST', headers:{Authorization:`Bearer ${token}`}, body: form}
    );
  } else {
    await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${filename}:/content`,
      {method:'PUT', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body}
    );
  }
};

const cloudLoadAll = async (provider, token) => {
  try {
    if (provider === 'google') {
      const lst = await fetch(
        `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name+contains+'sa_stmt_'&fields=files(id,name)`,
        {headers:{Authorization:`Bearer ${token}`}}
      ).then(r => r.json());
      return Promise.all((lst.files||[]).map(f =>
        fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {headers:{Authorization:`Bearer ${token}`}}).then(r => r.json())
      ));
    } else {
      const lst = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$filter=startswith(name,'sa_stmt_')`,
        {headers:{Authorization:`Bearer ${token}`}}
      ).then(r => r.json());
      return Promise.all((lst.value||[]).map(f =>
        fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${f.id}/content`, {headers:{Authorization:`Bearer ${token}`}}).then(r => r.json())
      ));
    }
  } catch { return []; }
};

const cloudGetUser = async (provider, token) => {
  try {
    if (provider === 'google') {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{Authorization:`Bearer ${token}`}}).then(r => r.json());
      return {name: r.name, email: r.email};
    } else {
      const r = await fetch('https://graph.microsoft.com/v1.0/me', {headers:{Authorization:`Bearer ${token}`}}).then(r => r.json());
      return {name: r.displayName, email: r.mail || r.userPrincipalName};
    }
  } catch { return null; }
};

// ── M365 Workspace helpers ─────────────────────────────────────────────────
// These operate on a regular OneDrive folder (not special/approot) so the
// folder can be shared with colleagues via an "Anyone with the link" share.
const MS_GRAPH = 'https://graph.microsoft.com/v1.0';

const wsCreateFolder = async (token, name) => {
  const r = await fetch(`${MS_GRAPH}/me/drive/root/children`, {
    method: 'POST',
    headers: {Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
    body: JSON.stringify({name, folder:{}, '@microsoft.graph.conflictBehavior':'rename'}),
  }).then(r => r.json());
  if (r.error) throw new Error(r.error.message || 'Could not create workspace folder');
  return r;
};

// Encode share URL as Microsoft "shareId" for Graph API access
const wsShareId = url => 'u!' + btoa(url).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');

const wsResolveShare = async (token, shareUrl) => {
  const sid = wsShareId(shareUrl.trim());
  const r = await fetch(`${MS_GRAPH}/shares/${sid}/driveItem`, {
    headers: {Authorization:`Bearer ${token}`},
  }).then(r => r.json());
  if (r.error) throw new Error(r.error.message || 'Could not access shared folder — check the link is "Anyone with the link can edit"');
  return r;
};

const wsSaveFile = async (token, driveId, folderId, filename, data) => {
  const base = driveId
    ? `${MS_GRAPH}/drives/${driveId}/items/${folderId}`
    : `${MS_GRAPH}/me/drive/items/${folderId}`;
  await fetch(`${base}:/${filename}:/content`, {
    method: 'PUT',
    headers: {Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
    body: JSON.stringify(data),
  });
};

const wsLoadFile = async (token, driveId, folderId, filename) => {
  const base = driveId
    ? `${MS_GRAPH}/drives/${driveId}/items/${folderId}`
    : `${MS_GRAPH}/me/drive/items/${folderId}`;
  const r = await fetch(`${base}:/${filename}:/content`, {headers:{Authorization:`Bearer ${token}`}});
  if (!r.ok) return null;
  return r.json().catch(() => null);
};

const wsListStmts = async (token, driveId, folderId) => {
  const base = driveId
    ? `${MS_GRAPH}/drives/${driveId}/items/${folderId}`
    : `${MS_GRAPH}/me/drive/items/${folderId}`;
  const r = await fetch(`${base}/children`, {headers:{Authorization:`Bearer ${token}`}}).then(r => r.json());
  const files = (r.value || []).filter(f => f.name?.startsWith('sa_stmt_'));
  return Promise.all(files.map(f => {
    const dlBase = driveId
      ? `${MS_GRAPH}/drives/${driveId}/items/${f.id}`
      : `${MS_GRAPH}/me/drive/items/${f.id}`;
    return fetch(`${dlBase}/content`, {headers:{Authorization:`Bearer ${token}`}}).then(r => r.json()).catch(() => null);
  }));
};
// ─────────────────────────────────────────────────────────────────────────────

const dlWorkbook = (s, rec, treatmentMem = {}) => {
  const treatmentLabels = Object.fromEntries(
    Object.entries(treatmentMem).map(([k, v]) => [k, gstJersey.treatments.find(t => t.key === v)?.label || v])
  );
  const wb = buildAuditWorkbook(s, rec, treatmentLabels);
  const bank = (s.bankName||'Bank').replace(/\s+/g,'_');
  const pfx  = TRIAL_MODE ? 'TRIAL_' : '';
  const d = str => str.split('/').reverse().join('-');
  const name = s.period?.from
    ? `${pfx}${bank}_${d(s.period.from)}_to_${d(s.period.to)}_Audit.xlsx`
    : `${pfx}${bank}_Audit.xlsx`;
  XLSX.writeFile(wb, name);
};

// Splits matches into cross-statement (genuine double-count — block the gate, red)
// and same-statement (a legitimate same-day repeat — soft amber "verify", does NOT block).
const findDupes = stmts => {
  const all = stmts.flatMap(s => (s.editedTransactions||s.transactions||[]).map(t => ({...t, sid:s.id})));
  const cross = new Set(), same = new Set(), crossPairs = [];
  for (let i = 0; i < all.length; i++) for (let j = i+1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.date === b.date
      && ((a.debit != null && a.debit === b.debit) || (a.credit != null && a.credit === b.credit))
      && (a.payee||'').toLowerCase().trim() === (b.payee||'').toLowerCase().trim()
      && (a.payee||'').length > 2) {
      const set = a.sid === b.sid ? same : cross;
      set.add(`${a.sid}:${a.id}`); set.add(`${b.sid}:${b.id}`);
      if (a.sid !== b.sid) crossPairs.push({ a:{sid:a.sid,tid:a.id}, b:{sid:b.sid,tid:b.id} });
    }
  }
  return { cross, same, crossPairs };
};

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

// Normalise a payee/description string to a stable lookup key for payee memory matching.
const normKey = (payee, description) => {
  const s = (payee && payee.trim()) || (description && description.trim()) || '';
  return s.toUpperCase().replace(/\s+/g, ' ');
};

const CATEGORIES = [
  'Bills & Utilities','Groceries','Eating Out','Transport',
  'Shopping','Entertainment','Healthcare','Insurance',
  'Salary / Income','Bank Charges','Transfers','Subscriptions','Other',
];

// ─── Main Component ────────────────────────────────────────────────────────────
// ── Tooltip (Guide Mode) ───────────────────────────────────────────────────
// Wraps any element with a contextual hover bubble when Guide Mode is on.
// active = showTips from the App component, passed via props.
const Tip = ({ text, pos = 'bottom', active, children }) => {
  const [v, setV] = useState(false);
  if (!active || !text) return children;
  const above = pos === 'top';
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'stretch'}}
      onMouseEnter={() => setV(true)} onMouseLeave={() => setV(false)}>
      {children}
      {v && (
        <span style={{
          position:'absolute',
          ...(above ? {bottom:'calc(100% + 7px)'} : {top:'calc(100% + 7px)'}),
          left:'50%', transform:'translateX(-50%)',
          zIndex:9999,
          background:'#1B2032', color:'#E8EEFF',
          padding:'8px 12px', borderRadius:8,
          fontSize:11, lineHeight:1.55,
          maxWidth:250, minWidth:140, whiteSpace:'normal',
          boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
          pointerEvents:'none', textAlign:'left',
          fontWeight:400, fontFamily:'Inter,sans-serif',
        }}>
          {text}
          <span style={{
            position:'absolute',
            ...(above
              ? {bottom:-5, borderTop:'6px solid #1B2032', borderBottom:'none'}
              : {top:-5, borderBottom:'6px solid #1B2032', borderTop:'none'}),
            left:'50%', transform:'translateX(-50%)',
            width:0, height:0,
            borderLeft:'6px solid transparent', borderRight:'6px solid transparent',
          }}/>
        </span>
      )}
    </span>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [stmts,    setStmts]    = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tab,      setTab]      = useState('upload');
  const [editCell, setEditCell] = useState(null);
  const [editVal,  setEditVal]  = useState('');
  const [dragging, setDragging] = useState(false);
  const [running,  setRunning]  = useState(false);
  const [searchQ,  setSearchQ]  = useState('');
  const [detailIds,setDetailIds]= useState(() => new Set()); // statements expanded from fast-track to full review
  const [balEdit,  setBalEdit]  = useState(null); // {sid, field} for opening/closing balance editing
  const [balVal,   setBalVal]   = useState('');
  const [showPdf,  setShowPdf]  = useState(false); // PDF compare pane on the review screen
  const [pdfUrl,   setPdfUrl]   = useState(null);
  const [selIds,   setSelIds]   = useState(() => new Set()); // selected files in the processing queue
  const [showRaw,  setShowRaw]  = useState(() => new Set()); // raw response toggle — error rows only
  const [showDupeViewer, setShowDupeViewer] = useState(false);
  const [payeeMemory, setPayeeMemory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_payeeMemory') || '{}'); } catch { return {}; }
  });
  const [categoryMemory, setCategoryMemory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_categoryMemory') || '{}'); } catch { return {}; }
  });
  const [treatmentMemory, setTreatmentMemory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_treatmentMemory') || '{}'); } catch { return {}; }
  });
  const [trackingMemory, setTrackingMemory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_trackingMemory') || '{}'); } catch { return {}; }
  });
  // source:'csv'|'api'|'none'; cats:[{name,options[]}] (max 2, Xero limit)
  // source field is the switch point — swap importTrackingCSV for an API call to change source
  const [trackingCategories, setTrackingCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_trackingCategories') || '{"source":"none","cats":[]}'); }
    catch { return {source:'none', cats:[]}; }
  });
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_projects') || 'null') || [{id:'default',name:'Default Project'}]; }
    catch { return [{id:'default',name:'Default Project'}]; }
  });
  const [activeProjectId, setActiveProjectId] = useState(() =>
    localStorage.getItem('sa_activeProject') || 'default'
  );
  const [showNominal, setShowNominal] = useState(() =>
    localStorage.getItem('sa_showNominal') === 'true'
  );
  const [uploadDefaultType, setUploadDefaultType] = useState(() =>
    localStorage.getItem('sa_defaultType') || 'current'
  );
  const [uploadDefaultPlatform, setUploadDefaultPlatform] = useState(() =>
    localStorage.getItem('sa_defaultPlatform') || 'qbo'
  );
  const [uploadDefaultJurisdiction, setUploadDefaultJurisdiction] = useState(() =>
    localStorage.getItem('sa_defaultJurisdiction') || 'uk'
  );
  const [codingSuggestions, setCodingSuggestions] = useState({});
  const [renamingProjectId, setRenamingProjectId] = useState(null);
  const [renameProjectVal,  setRenameProjectVal]  = useState('');
  const [receiptTarget,     setReceiptTarget]     = useState(null); // {sid, tid}
  const [showShortcuts,     setShowShortcuts]     = useState(false);
  const [showHelp,          setShowHelp]          = useState(false);
  const [helpQuery,         setHelpQuery]         = useState('');
  const [showFeedback,      setShowFeedback]      = useState(false);
  const [feedbackText,      setFeedbackText]      = useState('');
  const [feedbackEmail,     setFeedbackEmail]     = useState('');
  const [feedbackSent,      setFeedbackSent]      = useState(false);
  const [feedbackSending,   setFeedbackSending]   = useState(false);
  const [showActivity,      setShowActivity]      = useState(false);
  const [sidebarCollapsed,  setSidebarCollapsed]  = useState(false);
  const [recCollapsed,      setRecCollapsed]      = useState(false);
  const [trialUsed,      setTrialUsed]      = useState(() => TRIAL_MODE ? parseInt(localStorage.getItem('sa_trialUsed') || '0', 10) : 0);
  const [showTrialGate,  setShowTrialGate]  = useState(() => TRIAL_MODE && !!TRIAL_CODE && localStorage.getItem('sa_trialUnlocked') !== TRIAL_CODE);
  const [trialCodeInput, setTrialCodeInput] = useState('');
  const [trialCodeError, setTrialCodeError] = useState(false);
  const [showTrialCap,   setShowTrialCap]   = useState(false);
  const [cloudProvider, setCloudProvider] = useState(() => localStorage.getItem('sa_cloudProvider') || 'none');
  const [cloudToken,    setCloudToken]    = useState(() => localStorage.getItem('sa_cloudToken')    || null);
  const [cloudUser,     setCloudUser]     = useState(() => { try { return JSON.parse(localStorage.getItem('sa_cloudUser')); } catch { return null; } });
  const [cloudSyncing,  setCloudSyncing]  = useState(false);
  const [cloudError,    setCloudError]    = useState(null);
  const [showCloud,     setShowCloud]     = useState(false);
  const [showTips,      setShowTips]      = useState(() => localStorage.getItem('sa_showTips') === 'true');
  // M365 Workspace state
  const [workspaceMode,      setWorkspaceMode]      = useState(() => localStorage.getItem('sa_wsMode')     || 'none');
  const [workspaceName,      setWorkspaceName]      = useState(() => localStorage.getItem('sa_wsName')     || '');
  const [workspaceFolderId,  setWorkspaceFolderId]  = useState(() => localStorage.getItem('sa_wsFolderId') || '');
  const [workspaceDriveId,   setWorkspaceDriveId]   = useState(() => localStorage.getItem('sa_wsDriveId')  || '');
  const [workspaceShareUrl,  setWorkspaceShareUrl]  = useState(() => localStorage.getItem('sa_wsShareUrl') || '');
  const [workspaceSyncing,   setWorkspaceSyncing]   = useState(false);
  const [workspaceError,     setWorkspaceError]     = useState(null);
  const [wsView,             setWsView]             = useState('none'); // 'none'|'create'|'join'
  const [wsCreateInput,      setWsCreateInput]      = useState('');
  const [wsJoinInput,        setWsJoinInput]        = useState('');
  const [showCodingModal, setShowCodingModal] = useState(false);
  const [codingStmtId,    setCodingStmtId]    = useState(null);
  const [codingLines,     setCodingLines]     = useState([]);
  const [autoConfirmMem,  setAutoConfirmMem]  = useState(false);
  const [emptyPeriodOk,   setEmptyPeriodOk]   = useState(false);
  const [chartAccounts,   setChartAccounts]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_chartAccounts') || '[]'); } catch { return []; }
  });
  const [qboImportRows, setQboImportRows] = useState(null); // null=closed, array=mapping modal open

  const stmtsRef          = useRef([]);
  const fileInputRef      = useRef(null);
  const rulesInputRef     = useRef(null);
  const qboInputRef       = useRef(null);
  const receiptInputRef   = useRef(null);
  const chartInputRef     = useRef(null);
  const trackingInputRef  = useRef(null);
  const payeeMemoryRef      = useRef({});
  const categoryMemoryRef   = useRef({});
  const treatmentMemoryRef  = useRef({});
  const trackingMemoryRef   = useRef({});

  useEffect(() => { stmtsRef.current = stmts; }, [stmts]);
  useEffect(() => {
    payeeMemoryRef.current = payeeMemory;
    localStorage.setItem('sa_payeeMemory', JSON.stringify(payeeMemory));
  }, [payeeMemory]);
  useEffect(() => {
    categoryMemoryRef.current = categoryMemory;
    localStorage.setItem('sa_categoryMemory', JSON.stringify(categoryMemory));
  }, [categoryMemory]);
  useEffect(() => {
    treatmentMemoryRef.current = treatmentMemory;
    localStorage.setItem('sa_treatmentMemory', JSON.stringify(treatmentMemory));
  }, [treatmentMemory]);
  useEffect(() => {
    trackingMemoryRef.current = trackingMemory;
    localStorage.setItem('sa_trackingMemory', JSON.stringify(trackingMemory));
  }, [trackingMemory]);
  useEffect(() => {
    localStorage.setItem('sa_trackingCategories', JSON.stringify(trackingCategories));
  }, [trackingCategories]);
  useEffect(() => { localStorage.setItem('sa_projects',         JSON.stringify(projects));  }, [projects]);
  useEffect(() => { localStorage.setItem('sa_activeProject',    activeProjectId);           }, [activeProjectId]);
  useEffect(() => { localStorage.setItem('sa_showNominal',      String(showNominal));       }, [showNominal]);
  useEffect(() => { localStorage.setItem('sa_defaultType',      uploadDefaultType);         }, [uploadDefaultType]);
  useEffect(() => { localStorage.setItem('sa_defaultPlatform',  uploadDefaultPlatform);     }, [uploadDefaultPlatform]);
  useEffect(() => { localStorage.setItem('sa_defaultJurisdiction', uploadDefaultJurisdiction); }, [uploadDefaultJurisdiction]);
  useEffect(() => { localStorage.setItem('sa_chartAccounts',    JSON.stringify(chartAccounts)); }, [chartAccounts]);

  // OAuth callback handler (Xero CoA + QBO CoA) — fires once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    if (!code || !state) return;
    // Strip OAuth params from URL without reload
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (state === 'xero_coa' && XERO_CLIENT_ID) {
      const verifier  = sessionStorage.getItem('xero_coa_verifier');
      const redirectUri = window.location.origin + cleanUrl;
      if (!verifier) return;
      sessionStorage.removeItem('xero_coa_verifier');
      (async () => {
        try {
          const tkResp = await fetch('/api/xero-token', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ code, codeVerifier: verifier, redirectUri }),
          });
          if (!tkResp.ok) { const e = await tkResp.json(); throw new Error(e.error||'Xero token exchange failed'); }
          const { access_token } = await tkResp.json();
          // Get tenant list
          const connResp = await fetch('https://api.xero.com/connections', {
            headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
          });
          const conns = await connResp.json();
          const tenantId = conns?.[0]?.tenantId;
          if (!tenantId) throw new Error('No Xero tenant found');
          // Fetch accounts
          const acResp = await fetch('https://api.xero.com/api.xro/2.0/Accounts?where=Status%3D%3D%22ACTIVE%22', {
            headers: { 'Authorization': `Bearer ${access_token}`, 'xero-tenant-id': tenantId, 'Accept': 'application/json' },
          });
          const acData = await acResp.json();
          const accounts = (acData?.Accounts || []).map(a => ({
            code: a.Code || '', name: a.Name || '', type: a.Type || '',
          })).filter(a => a.code || a.name);
          setChartAccounts(accounts);
          alert(`Xero Chart of Accounts loaded — ${accounts.length} accounts imported.`);
        } catch (err) {
          alert('Xero CoA import failed: ' + err.message);
        }
      })();
      return;
    }

    const qboState = sessionStorage.getItem('qbo_coa_state');
    if (state === qboState && state.startsWith('qbo_coa_') && QBO_CLIENT_ID) {
      const realmId = params.get('realmId');
      const redirectUri = window.location.origin + cleanUrl;
      sessionStorage.removeItem('qbo_coa_state');
      (async () => {
        try {
          const tkResp = await fetch('/api/qbo-token', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ code, redirectUri }),
          });
          if (!tkResp.ok) { const e = await tkResp.json(); throw new Error(e.error||'QBO token exchange failed'); }
          const { access_token } = await tkResp.json();
          const env = window.location.hostname.includes('localhost') ? 'sandbox' : 'production';
          const base = env === 'sandbox'
            ? 'https://sandbox-quickbooks.api.intuit.com'
            : 'https://quickbooks.api.intuit.com';
          const acResp = await fetch(
            `${base}/v3/company/${realmId}/query?query=select%20*%20from%20Account%20where%20Active%20%3D%20true&minorversion=65`,
            { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' } }
          );
          const acData = await acResp.json();
          const accounts = (acData?.QueryResponse?.Account || []).map(a => ({
            code: a.AcctNum || '', name: a.Name || '', type: a.AccountType || '',
          })).filter(a => a.code || a.name);
          setChartAccounts(accounts);
          alert(`QuickBooks Chart of Accounts loaded — ${accounts.length} accounts imported.`);
        } catch (err) {
          alert('QBO CoA import failed: ' + err.message);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('sa_showTips', String(showTips)); }, [showTips]);
  useEffect(() => { localStorage.setItem('sa_wsMode',      workspaceMode);     }, [workspaceMode]);
  useEffect(() => { localStorage.setItem('sa_wsName',      workspaceName);     }, [workspaceName]);
  useEffect(() => { localStorage.setItem('sa_wsFolderId',  workspaceFolderId); }, [workspaceFolderId]);
  useEffect(() => { localStorage.setItem('sa_wsDriveId',   workspaceDriveId);  }, [workspaceDriveId]);
  useEffect(() => { localStorage.setItem('sa_wsShareUrl',  workspaceShareUrl); }, [workspaceShareUrl]);

  useEffect(() => {
    const l = document.createElement('link');
    l.rel  = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(l);
    return () => document.head.removeChild(l);
  }, []);

  // Keyboard shortcuts: A=approve, R=reject, ←→=prev/next, ?=shortcut help
  useEffect(() => {
    const handler = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
      if (e.key === '?') { setShowShortcuts(v => !v); return; }
      if (tab !== 'audit') return;
      const all = stmtsRef.current.filter(s => ['review','approved','rejected'].includes(s.status));
      const stmt = all.find(x => x.id === activeId) || all[0];
      if (!stmt) return;
      const idx = all.findIndex(x => x.id === stmt.id);
      if (e.key === 'ArrowLeft'  && idx > 0)            { e.preventDefault(); setActiveId(all[idx-1].id); }
      if (e.key === 'ArrowRight' && idx < all.length-1) { e.preventDefault(); setActiveId(all[idx+1].id); }
      if ((e.key==='a'||e.key==='A') && stmt.status==='review' && stmt.reconciliation?.reconciled) {
        exportStmt(stmt);
        approve(stmt.id);
      }
      if ((e.key==='r'||e.key==='R') && stmt.status==='review') reject(stmt.id);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tab, activeId]);

  // Auto-select first reviewable statement when switching to audit tab
  useEffect(() => {
    if (tab === 'audit') {
      const reviewable = stmts.filter(s => ['review','approved','rejected'].includes(s.status));
      if (reviewable.length && !reviewable.find(s => s.id === activeId)) {
        setActiveId(reviewable[0].id);
      }
    }
  }, [tab, stmts, activeId]);

  // Create an object URL for the active statement's PDF only while the compare pane is open
  useEffect(() => {
    if (!showPdf || !activeId) { setPdfUrl(null); return; }
    const s = stmtsRef.current.find(x => x.id === activeId);
    if (!s?.file) { setPdfUrl(null); return; }
    const url = URL.createObjectURL(s.file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [showPdf, activeId]);

  // Trial: handle ?reset=<code> URL param — lets the owner clear the trial counter
  useEffect(() => {
    if (!TRIAL_MODE) return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get('reset');
    if (r && (r === TRIAL_CODE || r === 'owner')) {
      localStorage.removeItem('sa_trialUsed');
      localStorage.removeItem('sa_trialUnlocked');
      setTrialUsed(0);
      setShowTrialCap(false);
      if (TRIAL_CODE) setShowTrialGate(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OAuth redirect — exchange code for token on return from Google / OneDrive
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code'), provider = params.get('state');
    if (!code || (provider !== 'google' && provider !== 'microsoft')) return;
    window.history.replaceState({}, '', window.location.pathname);
    const cfg = CLOUD_CFG[provider];
    const verifier = sessionStorage.getItem('sa_pkce_verifier');
    if (!verifier || !cfg.clientId) return;
    sessionStorage.removeItem('sa_pkce_verifier');
    const redirectUri = window.location.origin + window.location.pathname;
    fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({client_id:cfg.clientId, grant_type:'authorization_code', code, redirect_uri:redirectUri, code_verifier:verifier}),
    })
      .then(r => r.json())
      .then(async r => {
        if (!r.access_token) { setCloudError(r.error_description || 'Auth failed'); return; }
        const user = await cloudGetUser(provider, r.access_token);
        setCloudProvider(provider); setCloudToken(r.access_token); setCloudUser(user);
        localStorage.setItem('sa_cloudProvider', provider);
        localStorage.setItem('sa_cloudToken', r.access_token);
        localStorage.setItem('sa_cloudUser', JSON.stringify(user));
        setCloudSyncing(true);
        cloudLoadAll(provider, r.access_token).then(loaded => {
          if (loaded.length) setStmts(prev => {
            const ids = new Set(prev.map(s => s.id));
            return [...prev, ...loaded.filter(s => s?.id && !ids.has(s.id))];
          });
          setCloudSyncing(false);
          setShowCloud(true);
        }).catch(err => { setCloudSyncing(false); setCloudError(err?.message || 'Cloud sync failed — check your connection and try reconnecting.'); });
      })
      .catch(err => setCloudError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save approved statements to cloud (personal approot or workspace folder)
  useEffect(() => {
    if (!cloudToken || cloudProvider === 'none') return;
    const unsaved = stmts.filter(s => s.status === 'approved' && !s.cloudSaved);
    unsaved.forEach(stmt => {
      const save = (cloudProvider === 'microsoft' && workspaceMode === 'active' && workspaceFolderId)
        ? wsSaveFile(cloudToken, workspaceDriveId, workspaceFolderId, `sa_stmt_${stmt.id}.json`, wsStripStmt(stmt))
        : cloudSaveStmt(cloudProvider, cloudToken, stmt);
      save.then(() => updateS(stmt.id, {cloudSaved: true})).catch(console.error);
    });
  }, [stmts, cloudToken, cloudProvider, workspaceMode, workspaceFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push workspace memory whenever any memory state changes (fires after exportP2 updates memory)
  useEffect(() => {
    if (workspaceMode !== 'active' || !cloudToken || !workspaceFolderId) return;
    wsSaveFile(cloudToken, workspaceDriveId, workspaceFolderId, 'workspace_memory.json', {
      payeeMemory, categoryMemory, treatmentMemory, trackingMemory,
      chartAccounts, trackingCategories,
      updatedBy: cloudUser?.email || 'unknown',
      updatedAt: new Date().toISOString(),
    }).catch(console.error);
  }, [payeeMemory, categoryMemory, treatmentMemory, trackingMemory]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTx   = s => s.editedTransactions || s.transactions || [];
  const active  = stmts.find(s => s.id === activeId);
  const dupes   = useMemo(() => findDupes(stmts.filter(s => ['review','approved'].includes(s.status))), [stmts]);
  const periods = useMemo(() => detectPeriods(stmts.filter(s => !['error','queued'].includes(s.status))), [stmts]);

  const cnts = useMemo(() => ({
    queued:    stmts.filter(s => s.status === 'queued').length,
    review:    stmts.filter(s => s.status === 'review').length,
    approved:  stmts.filter(s => s.status === 'approved').length,
    errors:    stmts.filter(s => s.status === 'error').length,
    flags:     stmts.flatMap(s => getTx(s)).filter(t => t.flagged).length,
    dupeCount: Math.round(dupes.cross.size / 2),
    failRec:   stmts.filter(s => ['review','approved'].includes(s.status) && !s.reconciliation?.reconciled).length,
  }), [stmts, dupes]);

  const updateS = (id, patch) => setStmts(p => p.map(s => s.id === id ? {...s, ...patch} : s));
  const toggleRaw = id => setShowRaw(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── File handling ──────────────────────────────────────────────────────
  const addFiles = useCallback(files => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfs.length) return;
    setStmts(prev => {
      const room = Math.max(0, 50 - prev.length);
      return [...prev, ...pdfs.slice(0, room).map(file => ({
        id:uid(), file, filename:file.name, status:'queued',
        projectId: activeProjectId,
        accountType: uploadDefaultType, platform: uploadDefaultPlatform,
        jurisdiction: uploadDefaultJurisdiction,
        bankName:'', accountName:'', period:null,
        openingBalance:null, closingBalance:null,
        transactions:[], editedTransactions:null, reconciliation:null, crossCheck:null, error:null, rawResponse:null,
      }))];
    });
    setTab('queue');
  }, [activeProjectId, uploadDefaultType, uploadDefaultPlatform, uploadDefaultJurisdiction]);

  // ── Claude API ─────────────────────────────────────────────────────────
  const processOne = useCallback(async id => {
    const stmt = stmtsRef.current.find(s => s.id === id);
    if (!stmt || stmt.status === 'processing') return;
    if (stmt.status === 'approved' && !window.confirm('Re-running will reset this approved statement to For Review and clear all edits. Continue?')) return;
    if (TRIAL_MODE && stmt.status !== 'approved') {
      const used = parseInt(localStorage.getItem('sa_trialUsed') || '0', 10);
      if (used >= TRIAL_LIMIT) { setShowTrialCap(true); return; }
    }
    updateS(id, { status:'processing', error:null, rawResponse:null });
    let capturedRaw = ''; // session-only React state — never persisted; cleared on re-run and on success
    try {
      const b64  = await toBase64(stmt.file);
      const resp = await fetch('/api/extract', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-6', max_tokens:32000,
          system: PROMPTS[stmt.accountType] || PROMPTS.current,
          messages:[
            { role:'user', content:[
              { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 }},
              { type:'text', text:'Extract all transactions from this statement and output the JSON. Your first character must be {. Do not write any page-by-page analysis, working notes, transaction list, or explanation — output the JSON object immediately and nothing else. Begin now.' }
            ]}
          ]
        })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(()=>({}));
        const body = JSON.stringify(e);
        if (resp.status === 429 || /exceeded_limit|rate_limit|overloaded/i.test(body))
          throw new Error('Usage limit reached — wait a moment, then press Run to retry.');
        throw new Error(e?.error?.message || `API ${resp.status}`);
      }
      const api     = await resp.json();
      const rawText = api.content?.find(b => b.type === 'text')?.text || '';
      capturedRaw = rawText;
      const raw     = rawText;  // model now returns the full JSON (no prefill to compensate for)
      const jsonStart = raw.indexOf('{');
      const jsonEnd   = raw.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found in response — please retry this file');
      const r = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      const transactions = (r.transactions||[]).map((t,i) => {
        const debit  = t.debit  != null ? +parseFloat(t.debit).toFixed(2)  : null;
        const credit = t.credit != null ? +parseFloat(t.credit).toFixed(2) : null;
        const remembered    = payeeMemoryRef.current[normKey(t.payee, t.description)];
        const rememberedCat = categoryMemoryRef.current[normKey(t.payee, t.description)];
        // LAYER-2-HOOK: model-inferred suggestion for unrecognised payees.
        // Build only when real-user data proves new-client unfamiliarity (not re-coding) is the bottleneck.
        return {
          ...t, id:t.id??i+1, flagged:false, notes:'',
          nominalCode: remembered || (debit != null ? 'Misc Expense' : 'Misc Revenue'),
          codeSource: remembered ? 'remembered' : 'holding',
          rememberCode: false,
          category: rememberedCat || '',
          wrapped: t.wrapped ?? false, ambiguous: t.ambiguous ?? false,
          debit, credit,
          balance: t.balance != null && t.balance !== '' && !isNaN(parseFloat(t.balance)) ? +parseFloat(t.balance).toFixed(2) : null,
        };
      });
      const base = {
        statementPaymentsOut:r.reconciliation?.statementPaymentsOut||0,
        statementPaymentsIn: r.reconciliation?.statementPaymentsIn||0,
        openingBalance: r.openingBalance ?? null,
        closingBalance: r.closingBalance ?? null,
      };
      const rec0base = recalc(transactions, base, stmt.accountType);
      let openingBalance = r.openingBalance ?? null;
      let rec0 = rec0base;
      // If the running-balance column confirms the printed opening is actually the
      // post-first-transaction figure (both independent anchors agree on a different true
      // opening), apply it now so the statement loads reconciled — no manual click needed.
      // The printed figure is retained for the explanatory note. Manual button still covers
      // the case where balances are absent or the two anchors disagree.
      if (rec0base.openingAnchorsAgree && rec0base.derivedOpening != null
          && openingBalance != null && Math.abs(rec0base.derivedOpening - openingBalance) >= 0.02) {
        const printed = openingBalance;
        openingBalance = rec0base.derivedOpening;
        rec0 = recalc(transactions, { ...base, openingBalance, printedOpening: printed, openingAdjusted: true }, stmt.accountType);
      }
      updateS(id, {
        status:'review', bankName:r.bankName||'Bank', accountName:r.accountName||'',
        period:r.period||null,
        openingBalance, closingBalance:r.closingBalance??null,
        transactions, editedTransactions:null,
        baseReconciliation: rec0,
        baseAccountType: stmt.accountType,
        reconciliation: rec0,
        confidenceScore: calcConfidence(rec0, transactions, api._textExtract?.crossCheck),
        crossCheck: api._textExtract?.crossCheck ?? null,
        extractedAt: Date.now(),
        rawResponse: null,
      });
      if (TRIAL_MODE) {
        const next = parseInt(localStorage.getItem('sa_trialUsed') || '0', 10) + 1;
        localStorage.setItem('sa_trialUsed', String(next));
        setTrialUsed(next);
        if (next >= TRIAL_LIMIT) setShowTrialCap(true);
      }
    } catch(err) { updateS(id, { status:'error', error:err.message, rawResponse: capturedRaw || null }); }
  }, []);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Process a list of statements one at a time, with a short pause between calls
  // so a large batch is less likely to trip the API's usage/concurrency limit.
  const runMany = async ids => {
    setRunning(true);
    for (let i = 0; i < ids.length; i++) {
      await processOne(ids[i]);
      if (i < ids.length - 1) await sleep(1200);
    }
    setRunning(false);
  };

  const processAll = async () => {
    const ids = stmtsRef.current.filter(s => s.status === 'queued').map(s => s.id);
    await runMany(ids);
    const first = stmtsRef.current.find(s => s.status === 'review');
    if (first) { setActiveId(first.id); setTab('audit'); }
  };

  const runErrored  = () => runMany(stmtsRef.current.filter(s => s.status === 'error').map(s => s.id));
  const runSelected = () => runMany([...selIds].filter(id => {
    const s = stmtsRef.current.find(x => x.id === id);
    return s && !['processing','approved'].includes(s.status);
  }));

  // Queue selection
  const toggleSel = id => setSelIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel  = () => setSelIds(new Set());
  const setTypeForSelected = type => { selIds.forEach(id => {
    const s = stmtsRef.current.find(x => x.id === id);
    if (s && !['processing','approved'].includes(s.status)) updateS(id, { accountType: type });
  }); };

  // ── Editing ────────────────────────────────────────────────────────────
  const startEdit = (sid, tid, field, val) => { setEditCell({sid,tid,field}); setEditVal(String(val??'')); };

  // Edit a statement-level figure (opening/closing balance or Payments Out/In), then re-reconcile.
  // Lets a human correct a misread figure so the statement reconciles — the gate, working.
  const commitBalEdit = () => {
    if (!balEdit) return;
    const { sid, field } = balEdit;
    const num = balVal.trim() === '' ? null : +parseFloat(balVal).toFixed(2);
    setStmts(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const isStmtFig = field === 'statementPaymentsOut' || field === 'statementPaymentsIn';
      const prevRec = isStmtFig
        ? { ...(s.reconciliation || {}), [field]: num ?? 0 }
        : { ...(s.reconciliation || {}), [field]: num, openingAdjusted: false, printedOpening: null };
      const txList = getTx(s);
      const rec = recalc(txList, prevRec, s.accountType);
      return isStmtFig
        ? { ...s, reconciliation: rec, confidenceScore: calcConfidence(rec, txList, s.crossCheck) }
        : { ...s, [field]: num, reconciliation: rec, confidenceScore: calcConfidence(rec, txList, s.crossCheck) };
    }));
    setBalEdit(null);
  };

  // One-click: set statement figures to match the CSV totals.
  // Used when the bank doesn't print Payments Out/In, so the LLM returns 0 and the full CSV total
  // becomes the variance. Setting both to the CSV totals drops txVar to £0.
  const matchStmtToCSV = sid => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const txList = getTx(s);
    const rec = recalc(txList, {
      ...s.reconciliation,
      statementPaymentsOut: +(s.reconciliation.csvDebitTotal  || 0).toFixed(2),
      statementPaymentsIn:  +(s.reconciliation.csvCreditTotal || 0).toFixed(2),
    }, s.accountType);
    return { ...s, reconciliation: rec, confidenceScore: calcConfidence(rec, txList, s.crossCheck) };
  }));

  // One-click: accept the opening balance the app worked out from the closing balance.
  // Remember the figure printed on the statement so we can explain the difference, not hide it.
  const useDerivedOpening = sid => setStmts(prev => prev.map(s => {
    if (s.id !== sid || s.reconciliation?.derivedOpening == null) return s;
    const num     = s.reconciliation.derivedOpening;
    const printed = s.reconciliation.openingBalance;
    const prevRec = { ...s.reconciliation, openingBalance: num, printedOpening: printed, openingAdjusted: true };
    const txList = getTx(s);
    const rec = recalc(txList, prevRec, s.accountType);
    return { ...s, openingBalance: num, reconciliation: rec, confidenceScore: calcConfidence(rec, txList, s.crossCheck) };
  }));

  // One-click: switch the account type and re-reconcile straight away (no re-extraction).
  const applyAccountType = (sid, type) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const txList = getTx(s);
    const rec = recalc(txList, s.reconciliation, type);
    return { ...s, accountType: type, reconciliation: rec, confidenceScore: calcConfidence(rec, txList, s.crossCheck) };
  }));

  const commitEdit = () => {
    if (!editCell) return;
    const {sid, tid, field} = editCell;
    let val = editVal;
    if (field === 'debit' || field === 'credit') val = editVal.trim() === '' ? null : +parseFloat(editVal).toFixed(2);
    setStmts(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const base    = [...(s.editedTransactions || s.transactions || [])];
      const extra   = field === 'nominalCode' ? { codeSource:'edited', rememberCode:true } : {};
      const updated = base.map(t => t.id === tid ? {...t, [field]:val, ...extra} : t);
      const rec     = recalc(updated, s.reconciliation, s.accountType);
      return {...s, editedTransactions:updated, reconciliation:rec, confidenceScore:calcConfidence(rec, updated, s.crossCheck)};
    }));
    setEditCell(null);
  };

  const toggleFlag = (sid, tid) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const base = [...(s.editedTransactions || s.transactions || [])];
    return {...s, editedTransactions: base.map(t => t.id === tid ? {...t, flagged:!t.flagged} : t)};
  }));

  const toggleRemember = (sid, tid) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const base = [...(s.editedTransactions || s.transactions || [])];
    return {...s, editedTransactions: base.map(t => t.id === tid ? {...t, rememberCode:!t.rememberCode} : t)};
  }));

  // Auto-backup: silently download updated rules JSON to Downloads on every Approve.
  // No user action required — the file lands in Downloads ready to drag to OneDrive/Google Drive.
  const autoBackupRules = (rules) => {
    if (!Object.keys(rules).length) return;
    const date = new Date().toISOString().slice(0,10);
    const blob = new Blob([JSON.stringify(rules, null, 2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `sa-payee-rules-${date}.json`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  // Manual export: use File System Access API (lets user pick OneDrive/Google Drive/Desktop)
  // with silent download fallback for Safari.
  const exportRules = async () => {
    if (!Object.keys(payeeMemory).length) return;
    const date = new Date().toISOString().slice(0,10);
    const filename = `sa-payee-rules-${date}.json`;
    const json = JSON.stringify(payeeMemory, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    if ('showSaveFilePicker' in window) {
      try {
        const fh = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON Rules File', accept: {'application/json': ['.json']} }],
        });
        const w = await fh.createWritable();
        await w.write(blob); await w.close();
        return;
      } catch(e) { if (e.name === 'AbortError') return; }
    }
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:filename});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const importRules = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported === 'object' && !Array.isArray(imported))
          setPayeeMemory(prev => ({...prev, ...imported}));
        else
          alert('Rules file not recognised — expected a JSON object. Export your rules first with "↓ Save Rules" and use that file.');
      } catch {
        alert('Could not read rules file — the file may be corrupt or the wrong format. Export your rules with "↓ Save Rules" to get a valid backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Parse a QBO bank rules .xls export and open the mapping modal.
  // Extracts: bank description keyword + QBO category (hint) from each rule row.
  const importRulesQBO = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {header:1});
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
          const [name, condStr, outStr] = rows[i];
          if (!condStr || !outStr) continue;
          try {
            const cond = JSON.parse(condStr);
            const out  = JSON.parse(outStr);
            const keyword     = cond.ruleConditions?.find(r => r.ruleType === 1)?.value || '';
            const qboCategory = out.ruleActions?.find(r => r.actionType === 0)?.value  || '';
            const payeeName   = out.ruleActions?.find(r => r.actionType === 5)?.value  || keyword;
            if (keyword || payeeName) parsed.push({ name: name||payeeName||keyword, keyword, payeeName, qboCategory, nominalCode: qboCategory });
          } catch {}
        }
        if (parsed.length) setQboImportRows(parsed);
        else alert('No rules found in this file — it may be empty or a different format. Export rules from QBO: Transactions → Bank Transactions → Rules → Export Rules.');
      } catch {
        alert('Could not read QBO rules file — select the .xls file exported directly from QBO (Transactions → Bank Transactions → Rules → Export Rules).');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const deleteTx = (sid, tid) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const base = (s.editedTransactions || s.transactions || []).filter(t => t.id !== tid);
    const rec  = recalc(base, s.reconciliation, s.accountType);
    return {...s, editedTransactions:base, reconciliation:rec, confidenceScore:calcConfidence(rec, base, s.crossCheck)};
  }));

  // One-click: swap a transaction's debit↔credit when the balance cross-check pinpoints it
  // as a likely sign-flip. Re-runs recalc so the integrity check immediately re-evaluates.
  const flipTx = (sid, tid) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const base = (s.editedTransactions || s.transactions || []).map(t => {
      if (t.id !== tid) return t;
      return t.debit != null ? {...t, credit: +t.debit.toFixed(2), debit: null}
                             : {...t, debit:  +t.credit.toFixed(2), credit: null};
    });
    const rec = recalc(base, s.reconciliation, s.accountType);
    return {...s, editedTransactions: base, reconciliation: rec, confidenceScore: calcConfidence(rec, base, s.crossCheck)};
  }));

  // JOB 1 — Reset whole statement: discard all human edits and return to as-loaded reconciled state.
  // Reverts edited transactions, opening/closing balance edits, and account-type switches.
  // Does NOT revert the deterministic two-anchor opening fix (baseReconciliation already has it baked in).
  const resetStatement = sid => setStmts(prev => prev.map(s => {
    if (s.id !== sid || !s.baseReconciliation) return s;
    const rec = recalc(s.transactions, s.baseReconciliation, s.baseAccountType);
    return { ...s, editedTransactions: null, accountType: s.baseAccountType,
      openingBalance: s.baseReconciliation.openingBalance,
      closingBalance: s.baseReconciliation.closingBalance,
      reconciliation: rec, confidenceScore: calcConfidence(rec, s.transactions, s.crossCheck) };
  }));

  // JOB 1 — Reset one row: replace a visible edited row with its original AI-extracted version.
  // Deleted rows are not accessible here; use resetStatement to restore them.
  const resetRow = (sid, tid) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const orig = s.transactions.find(t => t.id === tid);
    if (!orig) return s;
    const current = s.editedTransactions || s.transactions;
    const updated = current.map(t => t.id === tid ? orig : t);
    const rec = recalc(updated, s.reconciliation, s.accountType);
    return { ...s, editedTransactions: updated, reconciliation: rec, confidenceScore: calcConfidence(rec, updated, s.crossCheck) };
  }));

  const approve = id => {
    const stmt = stmtsRef.current.find(s => s.id === id);
    if (stmt?.reconciliation && !stmt.reconciliation.reconciled) return; // hard-block: gate refuses non-reconciling statements
    const toRemember = getTx(stmt).filter(t => t.codeSource === 'edited' && t.rememberCode && t.nominalCode);
    if (toRemember.length) {
      const updatedMemory = {...payeeMemoryRef.current};
      toRemember.forEach(t => { updatedMemory[normKey(t.payee, t.description)] = t.nominalCode; });
      setPayeeMemory(updatedMemory);
      autoBackupRules(updatedMemory); // auto-download to Downloads — no user action needed
    }
    const toCatRemember = getTx(stmt).filter(t => t.category && t.category !== '');
    if (toCatRemember.length) {
      const updCat = {...categoryMemoryRef.current};
      toCatRemember.forEach(t => { updCat[normKey(t.payee, t.description)] = t.category; });
      setCategoryMemory(updCat);
    }
    updateS(id, {status:'approved', approvedAt: Date.now()});
    const nextStmt = stmtsRef.current.find(s => s.status === 'review' && s.id !== id);
    if (nextStmt) setActiveId(nextStmt.id);
    else setTab('export');
  };
  const reject = id => updateS(id, {status:'rejected', rejectedAt: Date.now()});
  const exportStmt = stmt => { dlFile(buildCSV(stmt), makeName(stmt)); updateS(stmt.id, {exportedAt: Date.now()}); };

  const openCodingModal = sid => {
    const stmt = stmtsRef.current.find(s => s.id === sid);
    if (!stmt) return;
    const tx = getTx(stmt);
    const lines = tx.map(t => {
      const key = normKey(t.payee, t.description);
      const memCode      = categoryMemoryRef.current[key] || payeeMemoryRef.current[key];
      const memTreatment = treatmentMemoryRef.current[key] || '';
      const memTracking  = trackingMemoryRef.current[key] || {};
      return {
        ...t,
        code:         memCode || (t.credit != null && t.debit == null ? 'Misc Revenue' : 'Misc Expense'),
        fromMemory:   !!memCode,
        gstTreatment: memTreatment,
        tracking1:    memTracking.t1 || '',
        tracking2:    memTracking.t2 || '',
        confirmed:    false,
      };
    });
    setCodingLines(lines);
    setCodingStmtId(sid);
    setAutoConfirmMem(false);
    setEmptyPeriodOk(false);
    setCodingSuggestions({});
    setShowCodingModal(true);
    // Layer 2 — batch AI code suggestions for unknown payees (silent, non-blocking)
    const unknowns = lines
      .filter(l => !l.fromMemory)
      .map(l => ({ payee: l.payee||'', description: l.description||'', normKey: normKey(l.payee, l.description) }))
      .filter(u => u.normKey);
    if (unknowns.length > 0) {
      fetch('/api/suggest-codes', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ payees: unknowns }),
      }).then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.suggestions) setCodingSuggestions(data.suggestions); })
        .catch(() => {});
    }
  };

  const updateCodingLine = (tid, patch) =>
    setCodingLines(prev => prev.map(l => l.id === tid ? {...l, ...patch} : l));

  const exportP2 = () => {
    const stmt = stmtsRef.current.find(s => s.id === codingStmtId);
    if (!stmt) return;
    // Save confirmed codes to categoryMemory
    const updCat = {...categoryMemoryRef.current};
    codingLines.forEach(l => {
      if (l.confirmed && l.code) {
        const key = normKey(l.payee, l.description);
        if (key) updCat[key] = l.code;
      }
    });
    setCategoryMemory(updCat);
    // Save confirmed GST treatments to treatmentMemory (Xero only)
    if (stmt.platform === 'xero') {
      const updTreat = {...treatmentMemoryRef.current};
      codingLines.forEach(l => {
        if (l.confirmed && l.gstTreatment) {
          const key = normKey(l.payee, l.description);
          if (key) updTreat[key] = l.gstTreatment;
        }
      });
      setTreatmentMemory(updTreat);
    }
    // Save confirmed tracking to trackingMemory (Xero only, when categories are loaded)
    if (stmt.platform === 'xero' && trackingCategories.cats.length > 0) {
      const updTrack = {...trackingMemoryRef.current};
      codingLines.forEach(l => {
        if (l.confirmed && (l.tracking1 || l.tracking2)) {
          const key = normKey(l.payee, l.description);
          if (key) updTrack[key] = {t1: l.tracking1 || '', t2: l.tracking2 || ''};
        }
      });
      setTrackingMemory(updTrack);
    }
    const codedLines = codingLines.map(l => ({...l, nominalCode: l.code, category: l.code}));
    if (stmt.platform === 'xero') {
      dlFile(buildXeroPrecoded(codedLines, stmt.jurisdiction || 'uk'), makeName(stmt, 'PRECODED'));
    } else {
      dlFile(buildQBO(codedLines), makeName(stmt, 'CODED_REF'));
    }
    approve(stmt.id);
    updateS(stmt.id, {pathway: 'p2'});
    setShowCodingModal(false);
  };

  const importChartCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = ev.target.result.split(/\r?\n/)
        .map(r => r.split(',').map(c => c.trim().replace(/^"(.*)"$/s, '$1')));
      if (rows.length < 2) return;
      const hdr = rows[0].map(h => h.replace(/^\*/, '').toLowerCase());
      const ci = hdr.findIndex(h => h === 'code' || h === 'account number');
      const ni = hdr.findIndex(h => h === 'name');
      const ti = hdr.findIndex(h => h === 'type');
      if (ci < 0 || ni < 0) {
        alert('Columns "Code" and "Name" not found.\n\nXero: Accounting → Chart of Accounts → Export\nQBO: Accounting → Chart of Accounts → Export → Excel/CSV');
        return;
      }
      const parsed = rows.slice(1)
        .filter(r => r[ci] && r[ni])
        .map(r => ({ code: r[ci], name: r[ni], type: ti >= 0 ? r[ti] : '' }));
      setChartAccounts(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Parses Xero's Tracking Settings CSV export: "Tracking Category Name,Tracking Option"
  // Replace this function body (keeping the signature + setTrackingCategories call) to switch
  // to a live Xero API pull when OAuth is available — source field will become 'api'.
  const importTrackingCSV = e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = (ev.target.result || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const map = {};
      lines.forEach((line, i) => {
        if (i === 0 && /tracking/i.test(line.split(',')[0])) return;
        const parts = line.split(',');
        const catName = (parts[0] || '').replace(/^"|"$/g, '').trim();
        const optName = (parts[1] || '').replace(/^"|"$/g, '').trim();
        if (!catName || !optName) return;
        if (!map[catName]) map[catName] = [];
        if (!map[catName].includes(optName)) map[catName].push(optName);
      });
      const cats = Object.entries(map).slice(0, 2).map(([name, options]) => ({name, options}));
      if (cats.length === 0) {
        alert('No valid tracking categories found.\n\nIn Xero: Settings → General Settings → Tracking → Export');
        return;
      }
      setTrackingCategories({source:'csv', loadedAt: Date.now(), cats});
    };
    reader.readAsText(file);
  };

  const startCloudAuth = async provider => {
    const cfg = CLOUD_CFG[provider];
    if (!cfg.clientId) { setCloudError(`${cfg.label} client ID not yet configured — contact support to enable.`); setShowCloud(true); return; }
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem('sa_pkce_verifier', verifier);
    const redirectUri = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      client_id: cfg.clientId, response_type: 'code',
      redirect_uri: redirectUri, scope: cfg.scope,
      code_challenge: challenge, code_challenge_method: 'S256', state: provider,
      ...(provider === 'google' ? {access_type:'offline', prompt:'consent'} : {}),
    });
    window.location.href = `${cfg.authUrl}?${params}`;
  };

  const disconnectCloud = () => {
    setCloudProvider('none'); setCloudToken(null); setCloudUser(null); setCloudError(null);
    localStorage.removeItem('sa_cloudProvider');
    localStorage.removeItem('sa_cloudToken');
    localStorage.removeItem('sa_cloudUser');
    wsLeave();
  };

  // ── M365 Workspace functions ───────────────────────────────────────────────
  const wsLeave = () => {
    setWorkspaceMode('none'); setWorkspaceName(''); setWorkspaceFolderId('');
    setWorkspaceDriveId(''); setWorkspaceShareUrl(''); setWorkspaceError(null);
    ['sa_wsMode','sa_wsName','sa_wsFolderId','sa_wsDriveId','sa_wsShareUrl'].forEach(k => localStorage.removeItem(k));
  };

  const wsStripStmt = s => {
    const tx = (s.editedTransactions || s.transactions || []).map(t =>
      ({...t, receipt: t.receipt ? {filename: t.receipt.filename} : undefined})
    );
    return {...s, editedTransactions:tx, transactions:tx, pdfData:undefined, rawResponse:undefined, file:undefined};
  };

  const wsBuildMemory = () => ({
    payeeMemory:        payeeMemoryRef.current,
    categoryMemory:     categoryMemoryRef.current,
    treatmentMemory:    treatmentMemoryRef.current,
    trackingMemory:     trackingMemoryRef.current,
    chartAccounts,
    trackingCategories,
    updatedBy:  cloudUser?.email || 'unknown',
    updatedAt:  new Date().toISOString(),
  });

  const wsMergeMemory = mem => {
    if (mem.payeeMemory)     setPayeeMemory(prev    => ({...mem.payeeMemory,    ...prev}));
    if (mem.categoryMemory)  setCategoryMemory(prev  => ({...mem.categoryMemory, ...prev}));
    if (mem.treatmentMemory) setTreatmentMemory(prev => ({...mem.treatmentMemory,...prev}));
    if (mem.trackingMemory)  setTrackingMemory(prev  => ({...mem.trackingMemory, ...prev}));
    if (mem.chartAccounts?.length    && !chartAccounts.length)           setChartAccounts(mem.chartAccounts);
    if (mem.trackingCategories?.cats?.length && !trackingCategories.cats?.length) setTrackingCategories(mem.trackingCategories);
  };

  const wsCreate = async () => {
    if (!cloudToken || cloudProvider !== 'microsoft') return;
    setWorkspaceSyncing(true); setWorkspaceError(null);
    try {
      const name = wsCreateInput.trim() || 'StatementAudit Pro';
      const folder = await wsCreateFolder(cloudToken, name);
      setWorkspaceName(folder.name); setWorkspaceFolderId(folder.id); setWorkspaceDriveId('');
      await wsSaveFile(cloudToken, '', folder.id, 'workspace_memory.json', wsBuildMemory());
      const approved = stmtsRef.current.filter(s => s.status === 'approved');
      for (const s of approved) {
        await wsSaveFile(cloudToken, '', folder.id, `sa_stmt_${s.id}.json`, wsStripStmt(s));
      }
      setWorkspaceMode('active'); setWsView('none');
    } catch(e) { setWorkspaceError(e.message || 'Failed to create workspace'); }
    finally { setWorkspaceSyncing(false); }
  };

  const wsJoin = async () => {
    if (!cloudToken || cloudProvider !== 'microsoft') return;
    setWorkspaceSyncing(true); setWorkspaceError(null);
    try {
      const item = await wsResolveShare(cloudToken, wsJoinInput.trim());
      const driveId = item.parentReference?.driveId || '';
      setWorkspaceName(item.name || 'Shared Workspace');
      setWorkspaceFolderId(item.id); setWorkspaceDriveId(driveId);
      setWorkspaceShareUrl(wsJoinInput.trim());
      const mem = await wsLoadFile(cloudToken, driveId, item.id, 'workspace_memory.json');
      if (mem) wsMergeMemory(mem);
      const loaded = await wsListStmts(cloudToken, driveId, item.id);
      const valid = loaded.filter(Boolean);
      if (valid.length) setStmts(prev => {
        const ids = new Set(prev.map(s => s.id));
        return [...prev, ...valid.filter(s => s?.id && !ids.has(s.id))];
      });
      setWorkspaceMode('active'); setWsView('none');
    } catch(e) { setWorkspaceError(e.message || 'Could not join workspace — check the link is "Anyone with the link can edit"'); }
    finally { setWorkspaceSyncing(false); }
  };

  const wsPushMemory = async () => {
    if (workspaceMode !== 'active' || !cloudToken || !workspaceFolderId) return;
    await wsSaveFile(cloudToken, workspaceDriveId, workspaceFolderId, 'workspace_memory.json', wsBuildMemory()).catch(console.error);
  };

  const wsPullMemory = async () => {
    if (workspaceMode !== 'active' || !cloudToken || !workspaceFolderId) return;
    setWorkspaceSyncing(true); setWorkspaceError(null);
    try {
      const mem = await wsLoadFile(cloudToken, workspaceDriveId, workspaceFolderId, 'workspace_memory.json');
      if (mem) wsMergeMemory(mem);
    } catch(e) { setWorkspaceError('Sync failed — ' + (e.message || 'check connection')); }
    finally { setWorkspaceSyncing(false); }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const checkTrialCode = () => {
    if (trialCodeInput.trim() === TRIAL_CODE) {
      localStorage.setItem('sa_trialUnlocked', TRIAL_CODE);
      setShowTrialGate(false);
      setTrialCodeError(false);
    } else {
      setTrialCodeError(true);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackSending(true);
    const formId = import.meta.env.VITE_FORMSPREE_ID;
    if (formId) {
      try {
        await fetch(`https://formspree.io/f/${formId}`, {
          method: 'POST',
          headers: {'Content-Type':'application/json', 'Accept':'application/json'},
          body: JSON.stringify({
            message:  feedbackText,
            email:    feedbackEmail || 'Not provided',
            _subject: 'StatementAudit Pro — User Feedback',
          }),
        });
        setFeedbackSent(true);
      } catch {
        window.location.href = `mailto:csmm1964@gmail.com?subject=StatementAudit%20Pro%20Feedback&body=${encodeURIComponent(feedbackText)}`;
        setFeedbackSent(true);
      }
    } else {
      window.location.href = `mailto:csmm1964@gmail.com?subject=StatementAudit%20Pro%20Feedback&body=${encodeURIComponent(feedbackText)}`;
      setFeedbackSent(true);
    }
    setFeedbackSending(false);
  };

  // ── Projects ────────────────────────────────────────────────────────────
  const addProject = () => {
    const name = window.prompt('New project name:');
    if (!name?.trim()) return;
    const id = uid();
    setProjects(prev => [...prev, {id, name: name.trim()}]);
    setActiveProjectId(id);
  };
  const renameProject = id => {
    setRenameProjectVal(projects.find(p => p.id === id)?.name || '');
    setRenamingProjectId(id);
  };
  const commitRename = () => {
    if (renameProjectVal.trim()) setProjects(prev => prev.map(p => p.id === renamingProjectId ? {...p, name: renameProjectVal.trim()} : p));
    setRenamingProjectId(null);
  };
  const moveStmt = (sid, projectId) => setStmts(prev => prev.map(s => s.id === sid ? {...s, projectId} : s));

  const attachReceipt = (sid, tid, file) => {
    const url = URL.createObjectURL(file);
    setStmts(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const current = s.editedTransactions || s.transactions || [];
      const updated = current.map(t => t.id === tid ? {...t, receipt:{url, filename:file.name}} : t);
      return {...s, editedTransactions: updated};
    }));
  };

  // ── Search ─────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQ || searchQ.length < 2) return [];
    const q = searchQ.toLowerCase();
    const results = [];
    for (const s of stmts.filter(s => !['queued','processing'].includes(s.status))) {
      for (const t of getTx(s)) {
        const hit = (t.description||'').toLowerCase().includes(q)
          || (t.payee||'').toLowerCase().includes(q)
          || (t.date||'').includes(searchQ)
          || (t.debit  != null && fmtN(t.debit).includes(q))
          || (t.credit != null && fmtN(t.credit).includes(q))
          || (t.nominalCode||'').toLowerCase().includes(q);
        if (hit) results.push({stmt:s, tx:t});
      }
    }
    return results.slice(0, 200);
  }, [searchQ, stmts]);

  // ── Style helpers ──────────────────────────────────────────────────────
  const btn = (v, dis=false) => {
    const base = { padding:'10px 18px', borderRadius:9, fontWeight:600, fontSize:14, cursor:dis?'not-allowed':'pointer',
      border:'1px solid transparent', transition:'all 0.15s', opacity:dis?0.5:1, fontFamily:'Inter,sans-serif', lineHeight:1.4 };
    const vs = {
      primary: { background:C.grn,    color:'#fff' },
      outline: { background:C.card, color:C.t2, border:`1px solid ${C.bdrBrt}` },
      danger:  { background:C.redDim, color:C.red, border:`1px solid ${C.redBrd}` },
      success: { background:C.grnDim, color:C.grn, border:`1px solid ${C.grnBrd}` },
    };
    return {...base, ...(vs[v]||vs.outline)};
  };

  const Pill = ({status}) => {
    const cfg = STATUS_CFG[status]||STATUS_CFG.queued;
    return <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,color:cfg.color,
      background:`${cfg.color}14`,border:`1px solid ${cfg.color}28`,letterSpacing:'0.04em',
      fontFamily:'Inter,sans-serif'}}>{cfg.label}</span>;
  };

  const TypeTag = ({type}) => {
    const col = TYPE_COL[type]||C.t2;
    return <span style={{padding:'2px 6px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.05em',
      background:`${col}16`,color:col}}>{type}</span>;
  };

  // Green ⚡ badge for a clean statement (≥95); amber NN/100 otherwise. Optional hint shows top fix.
  const ConfidenceBadge = ({score, size='sm', hint}) => {
    if (score == null) return null;
    const hi  = score >= 95;
    const big = size === 'lg';
    const tier = score >= 80 ? 'Good' : score >= 70 ? 'Fair' : 'Review';
    const col  = score >= 70 ? C.amb : C.red;
    const bg   = score >= 70 ? C.ambDim : C.redDim;
    const bdr  = score >= 70 ? C.ambBrd : C.redBrd;
    return <span title={!hi && hint && !big ? hint : undefined}
      style={{display:'inline-flex',alignItems:'center',gap:4,
        fontSize:big?13:10,fontWeight:700,padding:big?'4px 11px':'2px 8px',borderRadius:big?7:4,
        letterSpacing:'0.04em',fontFamily:'Inter,sans-serif',
        color:hi?C.grn:col,background:hi?C.grnDim:bg,border:`1px solid ${hi?C.grnBrd:bdr}`}}>
      {hi
        ? <>⚡ {big?'Passes every check':'High conf'}</>
        : big && hint
          ? <>{score}/100 <span style={{fontWeight:400,fontSize:11,opacity:0.85}}>— {hint}</span></>
          : `${score} · ${tier}`}
    </span>;
  };

  // ─────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────────
  const renderUpload = () => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:24}}>
      {/* Pre-upload configuration — matches simple converter pattern */}
      <div style={{display:'flex',gap:16,alignItems:'flex-end',justifyContent:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:11,color:C.t3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Account Type</div>
          <Tip text="Set this before processing. Current Account, Credit Card, Savings, etc. — tells the AI which debit/credit conventions to apply when reading the PDF." pos="bottom" active={showTips}>
          <select value={uploadDefaultType} onChange={e => setUploadDefaultType(e.target.value)}
            style={{background:C.card,border:`1px solid ${C.bdrBrt}`,borderRadius:9,padding:'10px 14px',
              color:ACCOUNT_TYPES[uploadDefaultType]?.color||C.t1,fontSize:13,outline:'none',cursor:'pointer',minWidth:190,
              fontFamily:'Inter,sans-serif',fontWeight:500}}>
            {Object.entries(ACCOUNT_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          </Tip>
        </div>
        <div>
          <div style={{fontSize:11,color:C.t3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Export To</div>
          <Tip text="Choose your accounting platform — this determines which CSV format is produced on export. Xero unlocks Pathway 2 (Code & Create) for empty periods." pos="bottom" active={showTips}>
          <select value={uploadDefaultPlatform} onChange={e => { setUploadDefaultPlatform(e.target.value); localStorage.setItem('sa_defaultPlatform', e.target.value); }}
            style={{background:C.card,border:`1px solid ${C.bdrBrt}`,borderRadius:9,padding:'10px 14px',
              color:uploadDefaultPlatform==='xero'?'#13B5EA':'#2CA01C',fontSize:13,outline:'none',cursor:'pointer',minWidth:190,
              fontFamily:'Inter,sans-serif',fontWeight:500}}>
            <option value="qbo">QuickBooks Online</option>
            <option value="xero">Xero</option>
          </select>
          </Tip>
        </div>
        <div>
          <div style={{fontSize:11,color:C.t3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Tax Jurisdiction</div>
          <Tip text="Sets the tax treatment options in Code & Create. UK VAT shows Standard 20%/Reduced 5%/Zero/Exempt/Outside Scope. Jersey shows GST (Standard 5%/Zero/Exempt/ISE/Outside Scope). 'Other' hides the tax column." pos="bottom" active={showTips}>
          <select value={uploadDefaultJurisdiction} onChange={e => { setUploadDefaultJurisdiction(e.target.value); localStorage.setItem('sa_defaultJurisdiction', e.target.value); }}
            style={{background:C.card,border:`1px solid ${C.bdrBrt}`,borderRadius:9,padding:'10px 14px',
              color:C.t1,fontSize:13,outline:'none',cursor:'pointer',minWidth:190,
              fontFamily:'Inter,sans-serif',fontWeight:500}}>
            <option value="uk">United Kingdom (VAT)</option>
            <option value="jersey">Jersey (GST)</option>
            <option value="other">Other / No Tax Column</option>
          </select>
          </Tip>
        </div>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);}}
        onClick={() => fileInputRef.current?.click()}
        style={{width:'100%',maxWidth:520,border:`2px dashed ${dragging?C.grn:C.bdrBrt}`,borderRadius:16,
          padding:'52px 40px',textAlign:'center',cursor:'pointer',
          background:dragging?C.grnDim:C.surf,transition:'all 0.2s',
          boxShadow:dragging?`0 0 40px rgba(0,212,126,0.12)`:'none'}}>
        <div style={{fontSize:40,marginBottom:12}}>📄</div>
        <div style={{fontSize:20,fontWeight:700,color:C.t1,marginBottom:8,fontFamily:'Inter,sans-serif'}}>
          Drop bank statement PDFs here
        </div>
        <div style={{fontSize:13,color:C.t2,marginBottom:22,lineHeight:1.8}}>
          Up to 50 files · Any UK bank<br/>
          Current · Savings · Credit Card · Loan / Mortgage<br/>
          Export to QuickBooks Online or Xero
        </div>
        <span style={{...btn('primary'),display:'inline-block'}}>Browse Files</span>
      </div>
      <div style={{fontSize:12,color:C.t3,textAlign:'center',lineHeight:1.7,maxWidth:460}}>
        Defaults apply to all uploaded files — override per file in the Queue if needed.<br/>
        Every statement requires human approval before CSV is generated.
      </div>
      {/* Data handling notice — required before external customers */}
      <div style={{maxWidth:520,background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:9,
        padding:'10px 16px',fontSize:11,color:C.t3,lineHeight:1.7,textAlign:'left'}}>
        <span style={{fontWeight:600,color:C.t2}}>Data handling:</span>{' '}
        Your PDF is sent securely over an encrypted connection to our server in Frankfurt (EU) and then to Anthropic's AI in the US for text extraction.
        No file or transaction data is stored on our servers at any point — everything stays in your browser until you export.
        By uploading, you confirm you have authority to process this statement.
      </div>
      <input ref={fileInputRef} type="file" multiple accept="application/pdf"
        style={{display:'none'}} onChange={e => addFiles(e.target.files)}/>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // QUEUE
  // ─────────────────────────────────────────────────────────────────────
  const renderQueue = () => (
    <div style={{display:'flex',flexDirection:'column',height:'100%',gap:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div>
          <div style={{fontSize:19,fontWeight:700,color:C.t1,fontFamily:'Inter,sans-serif'}}>Processing Queue</div>
          <div style={{fontSize:12,color:C.t2,marginTop:3}}>
            {stmts.length} file{stmts.length!==1?'s':''} · Set account type and platform before processing · Max 50 files
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Tip text="Add more PDF bank statements to the queue." pos="bottom" active={showTips}>
          <button onClick={() => fileInputRef.current?.click()} style={btn('outline')}>+ Add Files</button>
          </Tip>
          {cnts.errors > 0 && (
            <Tip text="Re-run all statements that failed on the last attempt." pos="bottom" active={showTips}>
            <button onClick={runErrored} disabled={running} style={btn('outline',running)}>↻ Run errored ({cnts.errors})</button>
            </Tip>
          )}
          {cnts.queued > 0 && (
            <Tip text="Send all queued files to the AI extraction engine. Each PDF is read, transactions extracted, and reconciled one at a time." pos="bottom" active={showTips}>
            <button onClick={processAll} disabled={running} style={btn('primary',running)}>
              {running ? '⟳ Processing…' : `▶ Process All (${cnts.queued})`}
            </button>
            </Tip>
          )}
        </div>
      </div>

      {selIds.size > 0 && (
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0,padding:'9px 14px',borderRadius:9,
          background:C.bluDim,border:`1px solid ${C.bluBrd}`,flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:600,color:C.blu}}>{selIds.size} selected</span>
          <button onClick={runSelected} disabled={running} style={{...btn('primary',running),padding:'6px 12px',fontSize:12}}>↻ Run selected</button>
          <span style={{fontSize:12,color:C.t2}}>Set type:</span>
          <select defaultValue="" onChange={e => { if(e.target.value){ setTypeForSelected(e.target.value); e.target.value=''; } }}
            style={{background:C.card,border:`1px solid ${C.bdrBrt}`,borderRadius:6,padding:'5px 8px',color:C.t1,fontSize:12,outline:'none',cursor:'pointer'}}>
            <option value="">Choose…</option>
            {Object.entries(ACCOUNT_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={clearSel} style={{...btn('outline'),padding:'6px 12px',fontSize:12}}>Clear</button>
        </div>
      )}

      {stmts.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'28px 1fr 155px 140px 85px 90px',gap:8,
          padding:'5px 12px',fontSize:11,color:C.t3,textTransform:'uppercase',letterSpacing:'0.07em',flexShrink:0,alignItems:'center'}}>
          <input type="checkbox"
            checked={(() => { const sel = stmts.filter(s => s.status !== 'processing'); return sel.length > 0 && sel.every(s => selIds.has(s.id)); })()}
            onChange={e => setSelIds(e.target.checked
              ? new Set(stmts.filter(s => s.status !== 'processing').map(s => s.id))
              : new Set())}
            style={{cursor:'pointer'}}/>
          <span>File</span><span>Account Type</span><span>Platform</span><span>Status</span><span></span>
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
        {stmts.map(s => {
          const locked   = s.status === 'processing'; // only actively processing rows are unselectable
          const editLock = ['processing','approved'].includes(s.status); // dropdowns still locked on approved
          return (
            <div key={s.id} style={{display:'grid',gridTemplateColumns:'28px 1fr 155px 140px 85px 90px',
              gap:8,alignItems:'center',padding:'10px 14px',borderRadius:9,
              border:`1px solid ${selIds.has(s.id)?C.bluBrd:C.bdr}`,background:selIds.has(s.id)?C.bluDim:C.card}}>
              <input type="checkbox" checked={selIds.has(s.id)} disabled={locked}
                onChange={() => toggleSel(s.id)} style={{cursor:locked?'not-allowed':'pointer',opacity:locked?0.4:1}}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:C.t1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {s.bankName ? `${s.bankName} · ${s.filename}` : s.filename}
                </div>
                {s.period && <div style={{fontSize:11,color:C.t3,marginTop:2}}>{s.period.from} → {s.period.to} · {getTx(s).length} txn</div>}
                {s.error   && <div style={{fontSize:11,color:C.red,marginTop:2}}>⚠ {s.error}</div>}
                {s.rawResponse && (
                  <div style={{marginTop:4}}>
                    <button onClick={() => toggleRaw(s.id)} style={{fontSize:10,color:C.t3,background:'none',border:`1px solid ${C.bdr}`,borderRadius:4,padding:'2px 6px',cursor:'pointer'}}>
                      {showRaw.has(s.id) ? 'Hide raw response' : 'Show raw response'}
                    </button>
                    {showRaw.has(s.id) && (
                      <div style={{marginTop:4,position:'relative'}}>
                        <pre style={{margin:0,fontSize:10,color:C.t2,background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'8px',maxHeight:160,overflowY:'auto',fontFamily:'JetBrains Mono,monospace',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{s.rawResponse}</pre>
                        <button onClick={() => navigator.clipboard.writeText(s.rawResponse)} style={{position:'absolute',top:4,right:4,fontSize:10,color:C.t3,background:C.card,border:`1px solid ${C.bdr}`,borderRadius:4,padding:'2px 6px',cursor:'pointer'}}>Copy</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <select value={s.accountType} disabled={editLock}
                onChange={e => updateS(s.id,{accountType:e.target.value})}
                style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'5px 8px',
                  color:ACCOUNT_TYPES[s.accountType]?.color||C.t1,fontSize:11,outline:'none',
                  cursor:editLock?'not-allowed':'pointer',opacity:editLock?0.6:1}}>
                {Object.entries(ACCOUNT_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <select value={s.platform} disabled={editLock}
                  onChange={e => updateS(s.id,{platform:e.target.value})}
                  style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'5px 8px',
                    color:s.platform==='xero'?'#13B5EA':'#2CA01C',fontSize:11,outline:'none',
                    cursor:editLock?'not-allowed':'pointer',opacity:editLock?0.6:1}}>
                  <option value="qbo">QuickBooks Online</option>
                  <option value="xero">Xero</option>
                </select>
                {s.platform==='xero' && (
                  <select value={s.jurisdiction||'uk'} disabled={editLock}
                    onChange={e => updateS(s.id,{jurisdiction:e.target.value})}
                    style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'4px 8px',
                      color:C.t2,fontSize:10,outline:'none',
                      cursor:editLock?'not-allowed':'pointer',opacity:editLock?0.6:1}}>
                    <option value="uk">UK VAT</option>
                    <option value="jersey">Jersey GST</option>
                    <option value="other">No Tax</option>
                  </select>
                )}
              </div>
              <Pill status={s.status}/>
              <div style={{display:'flex',gap:5}}>
                {['queued','error','rejected'].includes(s.status) && (
                  <Tip text="Extract transactions from this PDF now." pos="top" active={showTips}>
                  <button onClick={() => processOne(s.id)} style={{...btn('outline'),padding:'4px 10px',fontSize:11}}>Run</button>
                  </Tip>
                )}
                {['review','approved'].includes(s.status) && (
                  <Tip text="Open this statement in the Review tab." pos="top" active={showTips}>
                  <button onClick={() => {setActiveId(s.id);setTab('audit');}} style={{...btn('outline'),padding:'4px 10px',fontSize:11}}>View</button>
                  </Tip>
                )}
                {s.status !== 'processing' && (
                  <Tip text="Remove this file from the list." pos="top" active={showTips}>
                  <button onClick={() => setStmts(p => p.filter(x => x.id !== s.id))}
                    style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:13,padding:'2px 4px'}}>✕</button>
                  </Tip>
                )}
              </div>
            </div>
          );
        })}
        {stmts.length === 0 && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:C.t2,padding:40}}>
            <div style={{fontSize:32}}>📂</div>
            <button onClick={() => setTab('upload')} style={btn('primary')}>Upload Statements</button>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" multiple accept="application/pdf"
        style={{display:'none'}} onChange={e => addFiles(e.target.files)}/>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // AUDIT
  // ─────────────────────────────────────────────────────────────────────
  const renderAudit = () => {
    const reviewable = stmts.filter(s =>
      ['review','approved','rejected'].includes(s.status) &&
      (s.projectId || 'default') === activeProjectId
    );
    if (!reviewable.length) return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:14,color:C.t2}}>
        <div style={{fontSize:40}}>🔍</div>
        <div style={{fontSize:16,color:C.t1}}>No statements in this project yet</div>
        <div style={{fontSize:13,textAlign:'center',lineHeight:1.7,maxWidth:320}}>
          {cnts.queued > 0
            ? `${cnts.queued} file${cnts.queued!==1?'s':''} waiting in the Queue — process them to start reviewing`
            : cnts.processing > 0
              ? `${cnts.processing} file${cnts.processing!==1?'s':''} processing now — results will appear here`
              : 'Process statements in the Queue first, or switch projects using the sidebar dropdown'}
        </div>
        <button onClick={() => setTab('queue')} style={btn('primary')}>Go to Queue</button>
      </div>
    );

    const s = (active && reviewable.find(x => x.id === active.id)) ? active : reviewable[0];
    if (!s) return null;

    const txList     = getTx(s);
    const rec        = s.reconciliation;
    const flagCount  = txList.filter(t => t.flagged).length;
    const idx        = reviewable.findIndex(x => x.id === s.id);
    const atTypes    = ACCOUNT_TYPES[s.accountType]?.types || ACCOUNT_TYPES.current.types;
    const canEdit    = s.status === 'review';
    const isDupe      = tid => dupes.cross.has(`${s.id}:${tid}`);  // cross-statement: red, blocks gate
    const isRepeat    = tid => dupes.same.has(`${s.id}:${tid}`);   // same-statement: amber, does NOT block
    const isEd       = (tid,f) => editCell?.sid === s.id && editCell?.tid === tid && editCell?.field === f;
    const atCfg      = ACCOUNT_TYPES[s.accountType]||ACCOUNT_TYPES.current;
    const platColor  = s.platform==='xero'?'#13B5EA':'#2CA01C';
    const platLabel  = s.platform==='xero'?'Xero':'QBO';
    const score      = s.confidenceScore;
    const hasDupeStmt = txList.some(t => isDupe(t.id));
    const isGreen    = greenLit(score, rec, txList, hasDupeStmt);
    const fastTrack  = isGreen && s.status === 'review' && !detailIds.has(s.id) && !showPdf;
    const openDetail = () => setDetailIds(prev => { const n = new Set(prev); n.add(s.id); return n; });

    const tdBase = (ri, flagged, dp) => ({
      padding:'10px 12px', borderBottom:`1px solid ${C.bdr}`,
      background: dp ? C.redDim : flagged ? C.ambDim : ri%2===0 ? C.card : C.surf,
      cursor: canEdit ? 'text' : 'default', color:C.t1,
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    });

    const EI = ({field, type='text'}) => (
      <input autoFocus type={type} value={editVal}
        onChange={e => setEditVal(e.target.value)}
        onKeyDown={e => { if(e.key==='Enter') commitEdit(); if(e.key==='Escape') setEditCell(null); }}
        onBlur={commitEdit}
        style={{background:C.bg,border:`1px solid ${C.grn}`,borderRadius:4,padding:'2px 6px',
          color:C.t1,fontSize:12,width:'100%',outline:'none',
          fontFamily:type==='number'?'JetBrains Mono,monospace':'inherit'}}/>
    );

    const ES = ({field, opts}) => (
      <select autoFocus value={editVal}
        onChange={e => {setEditVal(e.target.value); setTimeout(commitEdit,60);}} onBlur={commitEdit}
        style={{background:C.surf,border:`1px solid ${C.grn}`,borderRadius:4,padding:'2px 6px',
          color:C.t1,fontSize:12,outline:'none'}}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    const EC = ({tid}) => {
      const dlId = `cat-dl-${tid}`;
      return (
        <>
          <input autoFocus type="text" value={editVal} list={dlId}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter') commitEdit(); if(e.key==='Escape') setEditCell(null); }}
            onBlur={commitEdit}
            style={{background:C.bg,border:`1px solid ${C.grn}`,borderRadius:4,padding:'2px 6px',
              color:C.t1,fontSize:12,width:'100%',outline:'none'}}/>
          <datalist id={dlId}>{CATEGORIES.map(c => <option key={c} value={c}/>)}</datalist>
        </>
      );
    };

    return (
      <div style={{display:'flex',height:'100%',gap:0}}>
        {/* Sidebar */}
        <div style={{width:sidebarCollapsed?40:210,flexShrink:0,borderRight:`1px solid ${C.bdr}`,background:C.surf,
          display:'flex',flexDirection:'column',transition:'width 0.18s',overflow:'hidden',position:'relative'}}>
          {/* Collapse toggle */}
          <button onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{position:'absolute',top:8,right:6,zIndex:2,background:C.card,border:`1px solid ${C.bdr}`,
              borderRadius:6,cursor:'pointer',color:C.t3,fontSize:13,padding:'3px 6px',lineHeight:1,flexShrink:0}}>
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
          {sidebarCollapsed ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:40,gap:8}}>
              <div style={{fontSize:10,fontWeight:700,color:C.t3,writingMode:'vertical-rl',letterSpacing:'0.08em',textTransform:'uppercase',transform:'rotate(180deg)'}}>
                Statements
              </div>
              {reviewable.length > 0 && (
                <span style={{background:C.blu,color:'#fff',borderRadius:10,fontSize:10,fontWeight:700,padding:'1px 6px'}}>{reviewable.length}</span>
              )}
            </div>
          ) : (
          <div style={{flex:1,overflowY:'auto',padding:'10px 8px',display:'flex',flexDirection:'column',gap:0}}>
          {/* Project selector — inline rename on ✏ click */}
          <div style={{marginBottom:8,padding:'0 2px',paddingRight:28}}>
            <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}>
              {renamingProjectId === activeProjectId
                ? <input autoFocus value={renameProjectVal}
                    onChange={e => setRenameProjectVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') commitRename(); if(e.key==='Escape') setRenamingProjectId(null); }}
                    onBlur={commitRename}
                    style={{flex:1,minWidth:0,background:C.card,border:`1px solid ${C.grn}`,borderRadius:6,
                      padding:'5px 7px',color:C.t1,fontSize:12,outline:'none',fontFamily:'Inter,sans-serif'}}/>
                : <select value={activeProjectId} onChange={e => setActiveProjectId(e.target.value)}
                    style={{flex:1,minWidth:0,background:C.card,border:`1px solid ${C.bdrBrt}`,borderRadius:6,
                      padding:'5px 7px',color:C.t1,fontSize:12,outline:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
              }
              <button onClick={() => renameProject(activeProjectId)} title="Rename project"
                style={{background:'none',border:`1px solid ${C.bdr}`,borderRadius:5,cursor:'pointer',
                  color:C.t2,fontSize:12,padding:'4px 7px',lineHeight:1}}>✏</button>
            </div>
            <button onClick={addProject}
              style={{width:'100%',background:'none',border:`1px solid ${C.bdr}`,borderRadius:6,
                cursor:'pointer',color:C.t3,fontSize:11,padding:'4px 0',fontFamily:'Inter,sans-serif'}}>+ New Project</button>
          </div>
          <div style={{fontSize:11,color:C.t3,textTransform:'uppercase',letterSpacing:'0.07em',padding:'4px 8px 6px',fontWeight:600}}>Statements</div>
          {reviewable.map(x => {
            const cfg   = STATUS_CFG[x.status];
            const isA   = x.id === s.id;
            const atC   = ACCOUNT_TYPES[x.accountType]||ACCOUNT_TYPES.current;
            const hasDp = getTx(x).some(t => dupes.cross.has(`${x.id}:${t.id}`));
            return (
              <div key={x.id} onClick={() => setActiveId(x.id)}
                style={{padding:'8px 10px',borderRadius:8,marginBottom:3,cursor:'pointer',
                  background:isA?C.card:'transparent',
                  border:`1px solid ${isA?C.bdrBrt:'transparent'}`,transition:'all 0.12s'}}>
                <div style={{fontSize:11,fontWeight:600,color:C.t1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:2}}>
                  {x.bankName||x.filename}
                </div>
                <div style={{fontSize:10,color:C.t3,marginBottom:4,fontFamily:'JetBrains Mono,monospace'}}>{x.period?.from||'—'}</div>
                <div style={{display:'flex',gap:3,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:11,fontWeight:700,padding:'1px 5px',borderRadius:3,color:atC.color,background:`${atC.color}14`}}>
                    {atC.label.split(' ')[0]}
                  </span>
                  <span style={{fontSize:11,fontWeight:700,padding:'1px 5px',borderRadius:3,color:cfg.color,background:`${cfg.color}14`}}>
                    {cfg.label}
                  </span>
                  {hasDp && <span style={{fontSize:11,fontWeight:700,color:C.red}}>DUPE</span>}
                  {x.reconciliation && !x.reconciliation.reconciled && <span style={{fontSize:11,color:C.amb}}>⚑</span>}
                  <ConfidenceBadge score={x.confidenceScore}/>
                  {(() => { const rc = getTx(x).filter(t => t.receipt).length; return rc > 0 ? <span title={`${rc} receipt${rc>1?'s':''} attached`} style={{fontSize:10,color:C.grn}}>📎{rc}</span> : null; })()}
                </div>
                <div style={{fontSize:10,color:C.t4,marginTop:3}}>
                  {x.approvedAt ? `Approved ${fmtTime(x.approvedAt)}` : x.extractedAt ? `Extracted ${fmtTime(x.extractedAt)}` : ''}
                </div>
                {projects.length > 1 && isA && (
                  <select value={x.projectId || 'default'}
                    onChange={e => { e.stopPropagation(); moveStmt(x.id, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    style={{marginTop:5,width:'100%',background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:4,
                      padding:'2px 5px',color:C.t2,fontSize:10,outline:'none',cursor:'pointer'}}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
            );
          })}
          </div>
          )} {/* end !sidebarCollapsed */}
        </div>

        {/* Main panel */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',padding:'0 0 0 16px'}}>
          {/* Header */}
          <div style={{flexShrink:0,paddingBottom:12,borderBottom:`1px solid ${C.bdr}`,marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                  <div style={{fontSize:17,fontWeight:700,color:C.t1,fontFamily:'Inter,sans-serif'}}>{s.bankName||s.filename}</div>
                  <Pill status={s.status}/>
                  <ConfidenceBadge score={score} hint={confidenceHint(score, rec, txList, s.crossCheck)}/>
                  <span style={{fontSize:10,fontWeight:700,color:atCfg.color,background:`${atCfg.color}14`,border:`1px solid ${atCfg.color}28`,padding:'2px 7px',borderRadius:3}}>{atCfg.label}</span>
                  <span style={{fontSize:10,fontWeight:700,color:platColor,background:`${platColor}14`,border:`1px solid ${platColor}28`,padding:'2px 7px',borderRadius:3}}>{platLabel}</span>
                </div>
                {s.accountName && <div style={{fontSize:12,color:C.t2}}>{s.accountName}</div>}
                {s.period && <div style={{fontSize:12,color:C.t2,fontFamily:'JetBrains Mono,monospace'}}>{s.period.from} — {s.period.to}</div>}
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:7,flexWrap:'wrap'}}>
                  <select value={s.accountType}
                    onChange={e => updateS(s.id,{accountType:e.target.value})}
                    title="Change account type, then Re-run to re-read with the right rules"
                    style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'4px 8px',
                      color:atCfg.color,fontSize:11,outline:'none',cursor:'pointer'}}>
                    {Object.entries(ACCOUNT_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <Tip text="Re-extract this statement. Use after changing Account Type, or if the first extraction failed or gave wrong results." pos="bottom" active={showTips}>
                  <button onClick={() => processOne(s.id)} disabled={running}
                    style={{...btn('outline',running),padding:'4px 11px',fontSize:11}}>↻ Re-run</button>
                  </Tip>
                  <Tip text="Open a side-by-side view of the original PDF alongside the extracted transactions — useful for verifying individual rows." pos="bottom" active={showTips}>
                  <button onClick={() => {
                      const next = !showPdf;
                      setShowPdf(next);
                      if (next) { setSidebarCollapsed(true); setRecCollapsed(true); }
                      else { setSidebarCollapsed(false); setRecCollapsed(false); }
                    }}
                    style={{...btn(showPdf?'success':'outline'),padding:'4px 11px',fontSize:11}}>📄 {showPdf?'Hide PDF':'Show PDF'}</button>
                  </Tip>
                  <Tip text="Show or hide the Nominal Code column in the transaction table. Nominal codes are saved to payee memory and appear in the export." pos="bottom" active={showTips}>
                  <button onClick={() => setShowNominal(v => !v)}
                    style={{...btn(showNominal?'success':'outline'),padding:'4px 11px',fontSize:11}}>🔢 {showNominal?'Hide Nominal':'Nominal codes'}</button>
                  </Tip>
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                <button onClick={() => idx>0 && setActiveId(reviewable[idx-1].id)} disabled={idx<=0} style={btn('outline')}>← Prev</button>
                <span style={{fontSize:11,color:C.t2,fontFamily:'JetBrains Mono,monospace',padding:'0 4px'}}>{idx+1}/{reviewable.length}</span>
                <button onClick={() => idx<reviewable.length-1 && setActiveId(reviewable[idx+1].id)} disabled={idx>=reviewable.length-1} style={btn('outline')}>Next →</button>
                {canEdit && <>
                  <Tip text="Mark this statement as rejected. It stays in the list but won't export. You can reverse this at any time." pos="bottom" active={showTips}>
                  <button onClick={() => reject(s.id)} style={btn('danger')}>✕ Reject</button>
                  </Tip>
                  {!fastTrack && (rec?.reconciled
                    ? <>
                        <Tip text="Downloads the CSV and marks this statement as approved. Only active when the closing balance and statement figures both reconcile." pos="bottom" active={showTips}>
                        <button onClick={() => { exportStmt(s); approve(s.id); }} style={btn('primary')}>✓ Approve &amp; Export</button>
                        </Tip>
                        <Tip text={s.platform === 'xero'
                          ? 'Pathway 2 — confirm an account code for each line, then export one precoded Xero import file. For empty periods only.'
                          : 'Confirm an account code for each line and export a QBO CSV with reference codes for manual categorisation in QBO.'} pos="bottom" active={showTips}>
                        <button onClick={() => openCodingModal(s.id)}
                          style={{...btn('outline'),borderColor:C.grn,color:C.grn}}>
                          ✎ {s.platform === 'xero' ? 'Code & Create' : 'Code & Reference'}
                        </button>
                        </Tip>
                      </>
                    : <Tip text="The approval gate is blocked. Closing balance or statement figures don't match — fix the variance first." pos="bottom" active={showTips}><span style={{padding:'6px 14px',borderRadius:9,background:C.redDim,color:C.red,border:`1px solid ${C.redBrd}`,fontWeight:600,fontSize:13,fontFamily:'Inter,sans-serif',lineHeight:1.4}}>⛔ Fix required</span></Tip>
                  )}
                  {!fastTrack && txList.length > 0 && rec && (
                    <Tip text="Downloads a three-sheet Excel file — full transaction register, clean import data, and receipts list. Includes VAT/GST Treatment column for Xero Pathway 2." pos="bottom" active={showTips}>
                    <button onClick={() => dlWorkbook(s, s.reconciliation, treatmentMemoryRef.current)} style={{...btn('outline'),borderColor:C.grn,color:C.grn}}>↓ Audit Workbook</button>
                    </Tip>
                  )}
                  {!fastTrack && canEdit && (
                    <Tip text="Undo all inline edits and restore the original AI extraction. Useful if you want to start corrections from scratch." pos="bottom" active={showTips}>
                    <button
                      onClick={() => { if (s.editedTransactions && window.confirm('Reset all edits and return to the original AI extraction?')) resetStatement(s.id); }}
                      disabled={!s.editedTransactions}
                      title={s.editedTransactions ? 'Undo all inline edits and restore the original AI extraction' : 'No edits to reset'}
                      style={{...btn('outline'),borderColor:s.editedTransactions?C.amb:C.bdr,color:s.editedTransactions?C.amb:C.t4,
                        cursor:s.editedTransactions?'pointer':'default'}}>↺ Reset edits</button>
                    </Tip>
                  )}
                </>}
                {s.status==='approved' && <>
                  <Tip text="Re-download the approved CSV for this statement." pos="bottom" active={showTips}>
                  <button onClick={() => exportStmt(s)} style={btn('success')}>↓ Re-download CSV</button>
                  </Tip>
                  <Tip text="Download the Excel audit workbook for this statement." pos="bottom" active={showTips}>
                  <button onClick={() => dlWorkbook(s, s.reconciliation, treatmentMemoryRef.current)} style={{...btn('outline'),borderColor:C.grn,color:C.grn}}>↓ Audit Workbook</button>
                  </Tip>
                  <Tip text="Return to Review status without re-running — all data, edits, and coding are kept. Use to make corrections after approving." pos="bottom" active={showTips}>
                  <button
                    onClick={() => { if (window.confirm('Return this statement to Review? You can re-approve it at any time without re-running.')) updateS(s.id, {status:'review', approvedAt:undefined}); }}
                    title="Return to Review without re-running — all data and edits are kept"
                    style={{...btn('outline'),borderColor:C.amb,color:C.amb}}>↺ Roll back to Review</button>
                  </Tip>
                </>}
              </div>
            </div>
          </div>

          {/* Cross-statement checks + search across all statements */}
          <div style={{flexShrink:0,display:'flex',gap:10,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              placeholder="Search all statements — payee, amount, date…"
              style={{flex:'1 1 280px',minWidth:220,padding:'10px 14px',background:C.card,border:`1px solid ${C.bdrBrt}`,
                borderRadius:9,color:C.t1,fontSize:14,outline:'none',fontFamily:'Inter,sans-serif',boxSizing:'border-box'}}/>
            {cnts.dupeCount>0 && <span onClick={() => setShowDupeViewer(v => !v)} style={{fontSize:13,fontWeight:600,color:C.red,background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:8,padding:'8px 12px',cursor:'pointer'}}>⚠ {cnts.dupeCount} possible duplicate{cnts.dupeCount>1?'s':''} across statements — click to review</span>}
            {periods.overs.length>0 && <span style={{fontSize:13,fontWeight:600,color:C.red,background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:8,padding:'8px 12px'}}>⚠ {periods.overs.length} overlapping period{periods.overs.length>1?'s':''}</span>}
            {periods.gaps.length>0 && <span style={{fontSize:13,fontWeight:600,color:C.amb,background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:8,padding:'8px 12px'}}>⚑ {periods.gaps.length} possible missing statement{periods.gaps.length>1?'s':''}</span>}
          </div>
          {/* Cross-statement duplicate viewer — opened by clicking the dupe alert above */}
          {showDupeViewer && cnts.dupeCount > 0 && (
            <div style={{flexShrink:0,background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:9,padding:'12px 16px',marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:11,color:C.red,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Cross-Statement Duplicates — Read Only</div>
                <button onClick={() => setShowDupeViewer(false)} style={{fontSize:11,color:C.t3,background:'none',border:`1px solid ${C.bdr}`,borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>✕ Close</button>
              </div>
              {dupes.crossPairs.length === 0
                ? <div style={{fontSize:12,color:C.t2}}>No cross-statement duplicates found.</div>
                : dupes.crossPairs.map((pair,i) => {
                    const sA = stmts.find(s => s.id === pair.a.sid);
                    const sB = stmts.find(s => s.id === pair.b.sid);
                    const tA = getTx(sA||{}).find(t => t.id === pair.a.tid);
                    const tB = getTx(sB||{}).find(t => t.id === pair.b.tid);
                    if (!tA || !tB) return null;
                    const amt = tA.debit != null ? `-${fmtCcy(tA.debit)}` : `+${fmtCcy(tA.credit||0)}`;
                    const stmtLabel = s => s ? `${s.bankName||'Bank'}${s.period ? ` · ${s.period.from}–${s.period.to}` : ''}` : '—';
                    return (
                      <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:i < dupes.crossPairs.length-1 ? `1px solid ${C.redBrd}` : 'none'}}>
                        <div style={{fontSize:12,color:C.red,fontFamily:'JetBrains Mono,monospace',marginBottom:6}}>{tA.date} · {tA.payee||tA.description||'—'} · {amt}</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          <button onClick={() => { setActiveId(pair.a.sid); setTab('audit'); }} style={{fontSize:11,color:C.t2,background:C.card,border:`1px solid ${C.bdr}`,borderRadius:4,padding:'3px 10px',cursor:'pointer'}}>{stmtLabel(sA)} ↗</button>
                          <button onClick={() => { setActiveId(pair.b.sid); setTab('audit'); }} style={{fontSize:11,color:C.t2,background:C.card,border:`1px solid ${C.bdr}`,borderRadius:4,padding:'3px 10px',cursor:'pointer'}}>{stmtLabel(sB)} ↗</button>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}
          {searchQ.length>=2 && (
            <div style={{flexShrink:0,marginBottom:10,maxHeight:210,overflowY:'auto',border:`1px solid ${C.bdr}`,borderRadius:10,background:C.card}}>
              <div style={{padding:'9px 14px',fontSize:13,color:C.t3,borderBottom:`1px solid ${C.bdr}`}}>
                {searchResults.length} match{searchResults.length!==1?'es':''} across all statements
              </div>
              {searchResults.map(({stmt,tx},i)=>(
                <div key={i} onClick={()=>{setActiveId(stmt.id);setSearchQ('');}}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:`1px solid ${C.bdr}`,cursor:'pointer'}}>
                  <TypeTag type={tx.paymentType}/>
                  <span style={{fontSize:14,fontWeight:500,color:C.t1}}>{tx.payee||tx.description}</span>
                  <span style={{fontSize:13,color:C.t3,fontFamily:'JetBrains Mono,monospace'}}>{tx.date}</span>
                  <span style={{fontSize:13,color:C.t3,marginLeft:'auto',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:160}}>{stmt.bankName||stmt.filename}</span>
                  {tx.debit!=null && <span style={{fontSize:14,fontWeight:600,color:C.red,fontFamily:'JetBrains Mono,monospace'}}>{fmtCcy(tx.debit)}</span>}
                  {tx.credit!=null && <span style={{fontSize:14,fontWeight:600,color:C.grn,fontFamily:'JetBrains Mono,monospace'}}>{fmtCcy(tx.credit)}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Reconciliation strip */}
          {rec && (
            <div style={{flexShrink:0,marginBottom:recCollapsed?6:12}}>
              {/* Collapsible header row */}
              <div onClick={() => setRecCollapsed(v => !v)}
                style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',marginBottom:recCollapsed?0:8,
                  padding:recCollapsed?'7px 14px':'3px 0',
                  background:recCollapsed?C.card:'transparent',
                  border:recCollapsed?`1px solid ${C.bdr}`:'none',
                  borderRadius:recCollapsed?9:0}}>
                <span style={{fontSize:10,color:C.t3,flexShrink:0}}>{recCollapsed?'▶':'▼'}</span>
                <span style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>
                  The numbers
                </span>
                {recCollapsed && (<>
                  <span style={{fontSize:11,color:C.t3}}>·</span>
                  <span style={{fontSize:12,fontFamily:'JetBrains Mono,monospace',color:C.t2,whiteSpace:'nowrap'}}>Open {fmtBal(rec.openingBalance)}</span>
                  <span style={{fontSize:12,fontFamily:'JetBrains Mono,monospace',color:C.red,whiteSpace:'nowrap'}}>Out {fmtCcy(rec.csvDebitTotal)}</span>
                  <span style={{fontSize:12,fontFamily:'JetBrains Mono,monospace',color:C.grn,whiteSpace:'nowrap'}}>In {fmtCcy(rec.csvCreditTotal)}</span>
                  <span style={{fontSize:11,color:C.t3}}>·</span>
                  <span style={{fontSize:12,fontFamily:'JetBrains Mono,monospace',color:C.t2,whiteSpace:'nowrap'}}>Close {fmtBal(rec.closingBalance)}</span>
                  <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,whiteSpace:'nowrap',
                    color:rec.reconciled?C.grn:C.red}}>
                    {rec.reconciled ? '✓ Reconciles' : `⚠ £${rec.variance?.toFixed(2)} variance`}
                  </span>
                </>)}
                {!recCollapsed && <span style={{fontSize:11,fontWeight:400,color:C.t3,textTransform:'none',letterSpacing:0,marginLeft:4}}>— click to collapse</span>}
              </div>
              {!recCollapsed && <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'18px 20px'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'16px 22px'}}>
                  {[
                    {label:'Transactions',          val:txList.length,                                                 color:C.t1, od:false},
                    {label:'Opening balance',       val:fmtBal(rec.openingBalance),    color:rec.openingBalance<0?C.red:C.t1,    od:rec.openingBalance<0, field:'openingBalance'},
                    {label:'Money out',             val:fmtCcy(rec.csvDebitTotal),     color:C.red,                              od:false},
                    {label:'Money in',              val:fmtCcy(rec.csvCreditTotal),    color:C.grn,                              od:false},
                    {label:'Closing (worked out)',  val:fmtBal(rec.calculatedClosing), color:rec.calculatedClosing<0?C.red:C.t1, od:rec.calculatedClosing<0},
                    {label:'Closing (on statement)',val:fmtBal(rec.closingBalance),    color:rec.closingBalance<0?C.red:C.t1,    od:rec.closingBalance<0, field:'closingBalance'},
                  ].map(({label,val,color,od,field}) => {
                    const editing = field && balEdit?.sid===s.id && balEdit?.field===field;
                    const canEditField = field && canEdit;
                    return (
                    <div key={label}>
                      <div style={{fontSize:13,color:C.t3,marginBottom:5}}>{label}{canEditField && <span style={{color:C.blu,marginLeft:5,fontSize:11}}>✎</span>}</div>
                      {editing ? (
                        <input autoFocus type="number" value={balVal}
                          onChange={e => setBalVal(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') commitBalEdit(); if(e.key==='Escape') setBalEdit(null); }}
                          onBlur={commitBalEdit}
                          style={{fontSize:19,fontWeight:600,color:C.t1,fontFamily:'JetBrains Mono,monospace',
                            width:'100%',padding:'2px 6px',border:`1px solid ${C.grn}`,borderRadius:5,outline:'none',boxSizing:'border-box'}}/>
                      ) : (
                        <div onClick={() => { if(canEditField){ setBalEdit({sid:s.id,field}); setBalVal(rec[field]==null?'':String(rec[field])); } }}
                          style={{fontSize:21,fontWeight:600,color,fontFamily:'JetBrains Mono,monospace',cursor:canEditField?'text':'default'}}>{val}</div>
                      )}
                      {od && <div style={{fontSize:12,color:C.red,marginTop:2}}>overdrawn</div>}
                      {field==='openingBalance' && rec.openingAdjusted && rec.printedOpening!=null && (
                        <div style={{fontSize:11,color:C.t3,marginTop:3,lineHeight:1.35}}>
                          brought forward — your statement shows {fmtBal(rec.printedOpening)} (the balance after the first transaction)
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
                {(rec.statementPaymentsOut > 0 || rec.statementPaymentsIn > 0 || (rec.txVar >= 0.02 && rec.csvDebitTotal > 0)) && (() => {
                  const sOut = rec.statementPaymentsOut || 0;
                  const sIn  = rec.statementPaymentsIn  || 0;
                  const figuresMissing = sOut === 0 && sIn === 0;
                  const cDeb = rec.csvDebitTotal  || 0;
                  const cCrd = rec.csvCreditTotal || 0;
                  const oGap = +(Math.abs(cDeb - sOut)).toFixed(2);
                  const iGap = +(Math.abs(cCrd - sIn)).toFixed(2);
                  return (
                    <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.bdr}`}}>
                      <div style={{fontSize:11,color:C.t3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,fontWeight:600}}>
                        Statement figures vs. your CSV {canEdit && <span style={{fontSize:10,fontWeight:400,textTransform:'none',letterSpacing:0,color:C.t3}}> — click Statement figure to correct if wrong</span>}
                      </div>
                      {figuresMissing && canEdit && (
                        <div style={{marginBottom:10,padding:'8px 12px',background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:6,fontSize:12,color:C.t1,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                          <span style={{flex:'1 1 260px'}}>⚠ Statement Payments Out/In were not read from this PDF — the full variance is your CSV total vs £0. Enter the figures from the statement, or if this bank doesn't print them:</span>
                          <button onClick={() => matchStmtToCSV(s.id)}
                            style={{...btn('outline'),borderColor:C.amb,color:C.amb,fontSize:12,padding:'5px 12px',whiteSpace:'nowrap'}}>
                            Set to match CSV
                          </button>
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr',gap:'5px 18px',alignItems:'center'}}>
                        <div/>
                        <div style={{fontSize:10,color:C.t3,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.05em'}}>Statement</div>
                        <div style={{fontSize:10,color:C.t3,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.05em'}}>Your CSV</div>
                        <div style={{fontSize:10,color:C.t3,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.05em'}}>Gap</div>
                        <div style={{fontSize:12,color:C.t2,whiteSpace:'nowrap'}}>Payments out</div>
                        {balEdit?.sid===s.id && balEdit?.field==='statementPaymentsOut'
                          ? <input autoFocus type="number" value={balVal} onChange={e=>setBalVal(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter')commitBalEdit();if(e.key==='Escape')setBalEdit(null);}}
                              onBlur={commitBalEdit}
                              style={{width:90,fontFamily:'JetBrains Mono,monospace',fontSize:13,padding:'2px 6px',border:`1px solid ${C.blu}`,borderRadius:4}}/>
                          : <div onClick={()=>canEdit&&(setBalEdit({sid:s.id,field:'statementPaymentsOut'}),setBalVal(String(sOut)))}
                              style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:C.t1,
                                cursor:canEdit?'text':'default',textDecoration:canEdit?'underline dotted':'none'}}>{fmtCcy(sOut)}</div>}
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:oGap>=0.02?C.red:C.grn}}>{fmtCcy(cDeb)}</div>
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:oGap>=0.02?C.red:C.t3}}>{oGap>=0.02?fmtCcy(oGap):'—'}</div>
                        <div style={{fontSize:12,color:C.t2,whiteSpace:'nowrap'}}>Payments in</div>
                        {balEdit?.sid===s.id && balEdit?.field==='statementPaymentsIn'
                          ? <input autoFocus type="number" value={balVal} onChange={e=>setBalVal(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter')commitBalEdit();if(e.key==='Escape')setBalEdit(null);}}
                              onBlur={commitBalEdit}
                              style={{width:90,fontFamily:'JetBrains Mono,monospace',fontSize:13,padding:'2px 6px',border:`1px solid ${C.blu}`,borderRadius:4}}/>
                          : <div onClick={()=>canEdit&&(setBalEdit({sid:s.id,field:'statementPaymentsIn'}),setBalVal(String(sIn)))}
                              style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:C.t1,
                                cursor:canEdit?'text':'default',textDecoration:canEdit?'underline dotted':'none'}}>{fmtCcy(sIn)}</div>}
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:iGap>=0.02?C.amb:C.grn}}>{fmtCcy(cCrd)}</div>
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:iGap>=0.02?C.amb:C.t3}}>{iGap>=0.02?fmtCcy(iGap):'—'}</div>
                      </div>
                    </div>
                  );
                })()}
                <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:10}}>
                  <span style={{width:24,height:24,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:14,fontWeight:700,color:'#fff',background:rec.reconciled?C.grn:(rec.openingLikelyOff?C.amb:C.red)}}>{rec.reconciled?'✓':'!'}</span>
                  <span style={{fontSize:15,color:C.t1}}>
                    {rec.reconciled
                      ? <>Everything adds up — <span style={{color:C.grn,fontWeight:600}}>this statement reconciles</span>.</>
                      : rec.openingLikelyOff
                        ? <>Almost there — the printed opening balance includes the first transaction, so it doesn't line up with the closing. <span style={{color:C.amb,fontWeight:600}}>One tap below sets the true opening and reconciles it.</span></>
                        : <>The numbers don't match — <span style={{color:C.red,fontWeight:600}}>£{rec.variance?.toFixed(2)} difference</span>. Check before approving.</>}
                  </span>
                </div>
                {!rec.integrityChecked && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.bdr}`,fontSize:12,color:C.t3,lineHeight:1.4}}>
                    No running balance read from this statement — totals checked, but individual rows can't be auto-verified.
                  </div>
                )}
                {rec.dateOrderWarning && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:8,fontSize:12,color:C.amb}}>
                    <span>⚑</span>
                    <span>Transactions appear out of date order — running balance checks may flag false breaks. Verify the statement's original row sequence.</span>
                  </div>
                )}
                {/* Dual-extraction cross-check status */}
                {s.crossCheck && (() => {
                  const cc = s.crossCheck;
                  if (cc.status === 'agree') return (
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:20,height:20,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',background:C.blu}}>⊕</span>
                      <span style={{fontSize:12,color:C.t2}}>Dual-path verified — <span style={{color:C.blu,fontWeight:600}}>text layer and AI agree on all {cc.llmCount} transactions</span>{cc.columnSwapCorrected ? ' (column order auto-corrected for this layout)' : ''}</span>
                    </div>
                  );
                  if (cc.status === 'partial') return (
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:20,height:20,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',background:C.amb}}>⊕</span>
                      <span style={{fontSize:12,color:C.t2}}>Dual-path check: <span style={{color:C.amb,fontWeight:600}}>{cc.flagged.length} transaction{cc.flagged.length!==1?'s':''} where text layer and AI differ</span> — review ⊕ rows below</span>
                    </div>
                  );
                  if (cc.status === 'count_mismatch') return (
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:20,height:20,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',background:C.red}}>⊕</span>
                      <span style={{fontSize:12,color:C.t2}}>Dual-path check: <span style={{color:C.red,fontWeight:600}}>AI read {cc.llmCount}, text layer read {cc.textCount} transactions</span> — count mismatch, check for dropped rows</span>
                    </div>
                  );
                  if (cc.status === 'unavailable') return (
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.bdr}`,fontSize:12,color:C.t3}}>
                      ⊕ Text layer: not available for this PDF — AI extraction only (scanned document or image-based PDF)
                    </div>
                  );
                  return null;
                })()}
              </div>
              } {/* end !recCollapsed */}
            </div>
          )}

          {/* Fast-track panel — shown only when all four green-light conditions hold.
              The reconciliation strip above stays visible; this adds the one-click approve.
              The ⚡ button calls the EXACT same handler as the standard Approve & Export. */}
          {fastTrack && (
            <div style={{flexShrink:0,marginBottom:12,background:C.grnDim,border:`1px solid ${C.grnBrd}`,borderRadius:12,padding:'18px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
                <ConfidenceBadge score={score} size="lg" hint={confidenceHint(score, rec, txList, s.crossCheck)}/>
                <span style={{fontSize:15,fontWeight:600,color:C.t1}}>This statement passes every check — reconciled, nothing flagged as unsure, no duplicates.</span>
              </div>
              <div style={{fontSize:13,color:C.t2,marginBottom:14,fontFamily:'JetBrains Mono,monospace'}}>
                Confidence: {score}/100 · {s.bankName||s.filename} · {atCfg.label} · {platLabel}
                {s.period && <> · {s.period.from} — {s.period.to}</>} · {txList.length} txn
              </div>
              <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                <button onClick={() => { exportStmt(s); approve(s.id); }}
                  style={{...btn('primary'),fontSize:15,padding:'12px 22px'}}>⚡ Approve &amp; Export</button>
                <button onClick={() => dlWorkbook(s, rec, treatmentMemoryRef.current)}
                  style={{...btn('outline'),fontSize:13,padding:'10px 18px',borderColor:C.grn,color:C.grn}}>↓ Audit Workbook</button>
                <span onClick={openDetail} style={{fontSize:13,color:C.blu,cursor:'pointer',fontWeight:600}}>Review in detail →</span>
              </div>
            </div>
          )}

          {/* Warnings (hidden in fast-track — by definition no dupes/variance there) */}
          {!fastTrack && (
          <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:5,marginBottom:6}}>
            {txList.some(t => isDupe(t.id)) && (
              <div style={{padding:'6px 12px',background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:6,fontSize:11,color:C.red}}>
                ⚠ Duplicate rows detected — highlighted in red. These also appear in another statement. Verify before approving.
              </div>
            )}
            {txList.some(t => isRepeat(t.id)) && (
              <div style={{padding:'6px 12px',background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:6,fontSize:11,color:C.amb}}>
                ◆ Repeated charge on the same day within this statement — highlighted amber. Real if the statement reconciles; verify if unsure.
              </div>
            )}
            {flagCount > 0 && (
              <div style={{padding:'6px 12px',background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:6,fontSize:11,color:C.amb}}>
                ⚑ {flagCount} row{flagCount!==1?'s':''} flagged — resolve before approving
              </div>
            )}
            {rec?.dataIssues?.length > 0 && (
              <div style={{padding:'6px 12px',background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:6,fontSize:11,color:C.amb}}>
                ⚠ {rec.dataIssues.length} row{rec.dataIssues.length!==1?' have':' has'} a data quality issue —
                {rec.dataIssues.filter(d=>d.issue==='no-amount').length > 0 && ` ${rec.dataIssues.filter(d=>d.issue==='no-amount').length} with no debit or credit set`}
                {rec.dataIssues.filter(d=>d.issue==='both-columns').length > 0 && ` ${rec.dataIssues.filter(d=>d.issue==='both-columns').length} with both debit and credit filled`}
                {rec.dataIssues.filter(d=>d.issue==='negative-value').length > 0 && ` ${rec.dataIssues.filter(d=>d.issue==='negative-value').length} with a negative amount`} — highlighted in amber below.
              </div>
            )}
            {rec && !rec.reconciled && !rec.openingLikelyOff && !(rec.balanceBreaks?.length) && (
              <div style={{padding:'6px 12px',background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:6,fontSize:11,color:C.red}}>
                ⚠ Reconciliation variance £{rec.variance?.toFixed(2)}{rec.notes?` — ${rec.notes}`:''}
              </div>
            )}
            {rec && !rec.reconciled && rec.balanceBreaks?.length > 0 && (
              <div style={{padding:'9px 12px',background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:6,fontSize:12,color:C.red}}>
                <div style={{fontWeight:600,marginBottom:4}}>⚠ The running balance doesn't add up — a transaction may be missing or entered the wrong way round.</div>
                {rec.balanceBreaks.slice(0, 3).map((b,i) => {
                  const flip = rec.flipSuggestions?.find(f => f.fromDate === b.fromDate && f.toDate === b.toDate);
                  return (
                    <div key={i} style={{color:C.t1,fontSize:11,marginTop:2}}>
                      <strong style={{fontFamily:'JetBrains Mono,monospace'}}>£{Math.abs(b.gap).toFixed(2)}</strong> unaccounted between <strong>{b.fromDate}</strong> and <strong>{b.toDate==='closing'?'the closing balance':b.toDate}</strong>
                      {flip ? ' — likely sign flip highlighted in amber below. Accept the suggestion to correct it.' : (b.hint || ' — check this stretch against the statement.')}
                    </div>
                  );
                })}
                {rec.balanceBreaks.length > 3 && (
                  <div style={{color:C.t2,fontSize:11,marginTop:4}}>…and {rec.balanceBreaks.length - 3} more — check the statement carefully for missing or wrongly-directed rows.</div>
                )}
              </div>
            )}
            {rec && rec.accountTypeLikelyWrong && rec.suggestedType && canEdit && (
              <div style={{padding:'9px 12px',background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:6,
                fontSize:12,color:C.t1,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span style={{flex:'1 1 320px'}}>
                  💡 These numbers don't add up as a <strong>{atCfg.label}</strong>, but they reconcile exactly as a <strong>{ACCOUNT_TYPES[rec.suggestedType]?.label}</strong> — the account type looks wrong.
                </span>
                <button onClick={() => applyAccountType(s.id, rec.suggestedType)} style={{...btn('primary'),padding:'6px 12px',fontSize:12}}>Switch to {ACCOUNT_TYPES[rec.suggestedType]?.label}</button>
              </div>
            )}
            {rec && rec.openingLikelyOff && canEdit && (
              <div style={{padding:'9px 12px',background:C.bluDim,border:`1px solid ${C.bluBrd}`,borderRadius:6,
                fontSize:12,color:C.t1,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span style={{flex:'1 1 320px'}}>
                  💡 The transactions match the statement's own totals, but the opening balance doesn't fit the closing balance.
                  The <strong style={{fontFamily:'JetBrains Mono,monospace'}}>{fmtBal(rec.openingBalance)}</strong> shown is the balance after the first transaction; the true brought-forward opening is <strong style={{fontFamily:'JetBrains Mono,monospace'}}>{fmtBal(rec.derivedOpening)}</strong>.
                </span>
                <button onClick={() => useDerivedOpening(s.id)} style={{...btn('primary'),padding:'6px 12px',fontSize:12}}>Use {fmtBal(rec.derivedOpening)}</button>
              </div>
            )}
            {rec && !rec.reconciled && canEdit && (
              <div style={{padding:'12px 14px',background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:8,fontSize:12}}>
                <div style={{fontWeight:700,color:C.red,marginBottom:8,fontSize:13}}>⛔ Approval blocked — variance of £{rec.variance?.toFixed(2)}</div>
                <div style={{color:C.t2,marginBottom:6,fontSize:11}}>Correct the following, then Approve &amp; Export will unlock:</div>
                <div style={{display:'flex',flexDirection:'column',gap:3,color:C.t1,fontSize:11}}>
                  {rec.flipSuggestions?.length > 0 && (
                    <div>• Accept the sign-flip suggestion on the amber-highlighted row in the table below.</div>
                  )}
                  {rec.balanceBreaks?.length > 0 && !(rec.flipSuggestions?.length > 0) && (
                    <div>• Check the date span flagged above — a row may be missing or have its direction wrong.</div>
                  )}
                  {rec.accountTypeLikelyWrong && rec.suggestedType && (
                    <div>• Switch account type using the button above — the numbers reconcile as a {ACCOUNT_TYPES[rec.suggestedType]?.label}.</div>
                  )}
                  {rec.openingLikelyOff && (
                    <div>• Use the correct opening balance shown in the blue helper above.</div>
                  )}
                  {s.crossCheck?.status === 'count_mismatch' && (() => {
                    const diff = Math.abs((s.crossCheck.llmCount ?? 0) - (s.crossCheck.textCount ?? 0));
                    return <div>• Text layer found {s.crossCheck.textCount} transactions, AI found {s.crossCheck.llmCount} — {diff} row{diff !== 1 ? 's' : ''} may be missing. Check all pages of the statement were uploaded and try re-running.</div>;
                  })()}
                  {!(rec.statementPaymentsOut > 0) && !(rec.statementPaymentsIn > 0) && (rec.csvDebitTotal || 0) >= 0.02 && (
                    <div>• Statement Payments Out/In were not read from this PDF — the entire £{rec.txVar?.toFixed(2)} variance is your CSV total vs £0. Scroll up to the <strong>Statement figures vs. your CSV</strong> strip, enter the correct figures, or click <strong>Set to match CSV</strong> if this bank doesn't print payment totals.</div>
                  )}
                  {(() => {
                    const oGap = +(Math.abs((rec.csvDebitTotal||0) - (rec.statementPaymentsOut||0))).toFixed(2);
                    const iGap = +(Math.abs((rec.csvCreditTotal||0) - (rec.statementPaymentsIn||0))).toFixed(2);
                    if (!(oGap >= 0.02 && Math.abs(oGap - iGap) < 0.02)) return null;
                    const candIds = rec.mirroredCandidates || [];
                    const candTxs = candIds.map(id => txList.find(t => t.id === id)).filter(Boolean);
                    return (
                      <>
                        <div>• Payments Out and Payments In are both off by <strong>£{oGap.toFixed(2)}</strong> — equal-and-opposite gaps are the signature of a transaction entered in the wrong direction.{candTxs.length === 0 && !(rec.pairCandidates||[]).length ? ` Look for a row where the amount is close to £${oGap.toFixed(2)}.` : ''}</div>
                        {candTxs.length > 0 && (
                          <div>• Candidate row{candTxs.length>1?'s':''}: {candTxs.map(t => {
                            const n = txList.indexOf(t) + 1;
                            return `#${n} (${t.date} · ${t.payee||t.description||'—'} · £${oGap.toFixed(2)})`;
                          }).join(', ')} — check {candTxs.length>1?'each row\'s':'this row\'s'} debit/credit direction.</div>
                        )}
                        {candTxs.length === 0 && (rec.pairCandidates||[]).length > 0 && (
                          <div>• No single row matches £{oGap.toFixed(2)} — but these pairs together do:{' '}
                            {(rec.pairCandidates||[]).slice(0,3).map(([ida,idb]) => {
                              const a = txList.find(t=>t.id===ida);
                              const b = txList.find(t=>t.id===idb);
                              if (!a || !b) return null;
                              return `#${txList.indexOf(a)+1} (${a.date} · £${(a.debit||a.credit||0).toFixed(2)}) + #${txList.indexOf(b)+1} (${b.date} · £${(b.debit||b.credit||0).toFixed(2)})`;
                            }).filter(Boolean).join('; ')}. Both rows in each pair may be in the wrong column.
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {!rec.flipSuggestions?.length && !rec.balanceBreaks?.length && !rec.accountTypeLikelyWrong && !rec.openingLikelyOff && !rec.integrityChecked && (
                    <div>• No running balance was read from this statement, so no single row can be pinpointed — check each transaction's money in/out is in the right column, and that no row is missing.</div>
                  )}
                  {!rec.flipSuggestions?.length && !rec.balanceBreaks?.length && !rec.accountTypeLikelyWrong && !rec.openingLikelyOff && rec.integrityChecked && s.crossCheck?.status !== 'count_mismatch' && (() => {
                    const ccFlagged = s.crossCheck?.flagged?.length ?? 0;
                    if (ccFlagged > 0)
                      return <div>• Review the ⊕ amber rows — AI and text layer disagree on the direction or amount of those {ccFlagged} transaction{ccFlagged !== 1 ? 's' : ''}.</div>;
                    if (flagCount > 0)
                      return <div>• Check the ⚑-flagged rows — review their debit/credit direction against the original statement.</div>;
                    return <div>• No specific row could be identified — review each transaction's debit (money out) and credit (money in) direction against the original statement PDF, and check for missing rows.</div>;
                  })()}
                </div>
              </div>
            )}
            {canEdit && (
              <div style={{padding:'5px 12px',background:C.bluDim,border:`1px solid ${C.bluBrd}`,borderRadius:6,fontSize:10,color:C.blu}}>
                ✎ Click cell to edit · Type dropdown on Type column · ⚑ flag · ✕ delete · Nominal Code and Notes export with CSV
              </div>
            )}
          </div>
          )}

          {/* Transaction table (+ optional PDF compare pane) */}
          {!fastTrack && (
          <div style={{flex:1,display:'flex',gap:12,overflow:'hidden'}}>
            <div style={{flex:1,minWidth:0,overflowY:'auto',overflowX:'auto',borderRadius:9,border:`1px solid ${C.bdr}`}}>
            {txList.length === 0 ? (
              <div style={{padding:'40px 24px',textAlign:'center',color:C.t2}}>
                <div style={{fontSize:15,fontWeight:600,color:C.t1,marginBottom:6}}>No transactions found in this file</div>
                <div style={{fontSize:13,maxWidth:460,margin:'0 auto',lineHeight:1.5}}>
                  This looks like a summary or cover page rather than a transactional statement — or the account type may be wrong. Try “↻ Re-run”, change the account type above, or upload the monthly statement instead.
                </div>
              </div>
            ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:1040}}>
              <thead>
                <tr style={{background:C.surf,position:'sticky',top:0,zIndex:2}}>
                  {['#','Date','Type','Description','Payee','Debit','Credit','Balance','Category',
                    ...(showNominal?['Nominal']:[]),'Notes','Receipt','⚑','✕','↺'].map((h,i) => (
                    <th key={i} style={{padding:'12px 12px',textAlign:[5,6,7].includes(i)?'right':'left',
                      color:C.t2,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'0.05em',
                      whiteSpace:'nowrap',borderBottom:`1px solid ${C.bdr}`,fontFamily:'Inter,sans-serif'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txList.map((t, ri) => {
                  const dp      = isDupe(t.id);                                              // cross-statement → red
                  const flipSug = rec?.flipSuggestions?.find(f => f.tid === t.id);
                  const ccFlag  = s.crossCheck?.status === 'partial'                         // dual-path disagreement
                    ? s.crossCheck.flagged?.find(f => f.index === ri) : null;
                  const hasDataIssue = rec?.dataIssues?.some(d => d.tid === t.id);
                  const td      = tdBase(ri, t.flagged || t.ambiguous || isRepeat(t.id) || !!flipSug || hasDataIssue, dp);
                  return (
                    <tr key={t.id}>
                      <td style={{...td,color:C.t3,fontFamily:'JetBrains Mono,monospace',fontSize:10,textAlign:'center',width:28}}>{ri+1}</td>
                      <td style={{...td,fontFamily:'JetBrains Mono,monospace',width:88}} onClick={() => canEdit && startEdit(s.id,t.id,'date',t.date)}>
                        {isEd(t.id,'date') ? <EI field="date"/> : t.date}
                      </td>
                      <td style={{...td,width:58}} onClick={() => canEdit && startEdit(s.id,t.id,'paymentType',t.paymentType)}>
                        {isEd(t.id,'paymentType') ? <ES field="paymentType" opts={atTypes}/> : <TypeTag type={t.paymentType}/>}
                      </td>
                      <td style={{...td,maxWidth:240,whiteSpace:'normal'}} onClick={() => canEdit && startEdit(s.id,t.id,'description',t.description)}>
                        {isEd(t.id,'description') ? <EI field="description"/> : (
                          <span>
                            <span title={t.description}>{t.description}</span>
                            {t.wrapped && <span style={{marginLeft:7,fontSize:11.5,fontWeight:600,color:C.t2,background:'#EEF1F6',borderRadius:999,padding:'2px 9px',whiteSpace:'nowrap'}}>Joined from 2 lines</span>}
                            {t.ambiguous && <span style={{marginLeft:7,fontSize:11.5,fontWeight:600,color:C.amb,background:C.ambDim,borderRadius:999,padding:'2px 9px',whiteSpace:'nowrap'}}>Worth a check</span>}
                            {flipSug && canEdit && (
                              <span style={{marginLeft:7,fontSize:11,fontWeight:600,color:C.amb,background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:6,padding:'2px 8px',whiteSpace:'normal',display:'inline-flex',alignItems:'center',gap:6}}>
                                {flipSug.msg}
                                <button onClick={e=>{e.stopPropagation();flipTx(s.id,t.id);}} style={{background:'none',border:`1px solid ${C.amb}`,borderRadius:4,cursor:'pointer',color:C.amb,fontWeight:700,padding:'1px 7px',fontSize:11,lineHeight:'18px',flexShrink:0}}>Accept</button>
                              </span>
                            )}
                            {ccFlag && (
                              <span title={ccFlag.issues.map(i=>`${i.field}: AI=${i.llm} text=${i.text}`).join('; ')}
                                style={{marginLeft:7,fontSize:11,fontWeight:600,color:C.blu,background:C.bluDim,border:`1px solid ${C.bluBrd}`,borderRadius:6,padding:'2px 8px',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:4}}>
                                ⊕ {ccFlag.issues.map(i => i.field === 'direction' ? `direction (AI:${i.llm}, text:${i.text})` : `${i.field} (AI:${typeof i.llm==='number'?i.llm.toFixed(2):i.llm}, text:${typeof i.text==='number'?i.text.toFixed(2):i.text})`).join(' · ')}
                              </span>
                            )}
                            {(() => { const fx = detectFX(t.description); return fx ? (
                              <span title={`Foreign currency transaction — ${fx.currency} detected`}
                                style={{marginLeft:7,fontSize:11,fontWeight:600,color:'#7C4DFF',background:'#EDE7FF',border:'1px solid #C9B8FF',borderRadius:6,padding:'2px 8px',whiteSpace:'nowrap'}}>
                                💱 {fx.currency}
                              </span>
                            ) : null; })()}
                          </span>
                        )}
                      </td>
                      <td style={{...td,maxWidth:130}} onClick={() => canEdit && startEdit(s.id,t.id,'payee',t.payee)}>
                        {isEd(t.id,'payee') ? <EI field="payee"/> : <span title={t.payee}>{t.payee}</span>}
                      </td>
                      <td style={{...td,textAlign:'right',color:t.debit?C.red:C.t3,fontFamily:'JetBrains Mono,monospace',width:78}}
                        onClick={() => canEdit && startEdit(s.id,t.id,'debit',t.debit)}>
                        {isEd(t.id,'debit') ? <EI field="debit" type="number"/> : fmtN(t.debit)}
                      </td>
                      <td style={{...td,textAlign:'right',color:t.credit?C.grn:C.t3,fontFamily:'JetBrains Mono,monospace',width:78}}
                        onClick={() => canEdit && startEdit(s.id,t.id,'credit',t.credit)}>
                        {isEd(t.id,'credit') ? <EI field="credit" type="number"/> : fmtN(t.credit)}
                      </td>
                      {(() => {
                        const expBal  = rec?.expectedBalances?.[t.id];
                        const prtBal  = t.balance;
                        const matched = prtBal != null && expBal != null && Math.abs(prtBal - expBal) < 0.01;
                        const broken  = prtBal != null && expBal != null && !matched;
                        return (
                          <td style={{...td,textAlign:'right',fontFamily:'JetBrains Mono,monospace',width:100,
                            color: broken ? C.amb : prtBal != null ? C.t1 : C.t3}}>
                            <span>{prtBal != null ? fmtBal(prtBal) : (expBal != null ? fmtBal(expBal) : '—')}</span>
                            {prtBal != null && expBal != null && (
                              <span style={{fontSize:9,marginLeft:4,color:broken?C.amb:C.grn}}>
                                {broken ? `≠${fmtBal(expBal)}` : '✓'}
                              </span>
                            )}
                          </td>
                        );
                      })()}
                      <td style={{...td,width:130}} onClick={() => canEdit && startEdit(s.id,t.id,'category',t.category||'')}>
                        {isEd(t.id,'category')
                          ? <EC tid={t.id}/>
                          : <span style={{color:t.category?C.t1:C.t3,fontSize:12}} title={t.category||'Click to categorise'}>{t.category||'—'}</span>}
                      </td>
                      {showNominal && <td style={{...td,width:112}} onClick={() => canEdit && startEdit(s.id,t.id,'nominalCode',t.nominalCode)}>
                        {isEd(t.id,'nominalCode') ? <EI field="nominalCode"/>
                          : t.codeSource==='remembered'
                            ? <span style={{display:'flex',alignItems:'center',gap:3}}>
                                <span style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:C.purDim,color:C.pur,border:`1px solid ${C.purBrd}`,fontWeight:700}}>📌</span>
                                <span style={{color:C.t1,fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{t.nominalCode}</span>
                              </span>
                            : t.codeSource==='holding'
                              ? <span style={{color:C.amb,fontFamily:'JetBrains Mono,monospace',fontSize:11}} title="Unrecognised — click to assign a code">{t.nominalCode}</span>
                              : t.codeSource==='edited'
                                ? <span style={{display:'flex',alignItems:'center',gap:4}}>
                                    <span style={{color:C.t1,fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{t.nominalCode}</span>
                                    <span onClick={e=>{e.stopPropagation();toggleRemember(s.id,t.id);}}
                                      style={{fontSize:9,padding:'1px 4px',borderRadius:3,cursor:'pointer',userSelect:'none',
                                        background:t.rememberCode?C.grnDim:'transparent',color:t.rememberCode?C.grn:C.t3,
                                        border:`1px solid ${t.rememberCode?C.grnBrd:C.bdr}`}}
                                      title={t.rememberCode?'Will save on approval — click to cancel':'Click to remember for next import'}>📌</span>
                                  </span>
                                : <span style={{color:t.nominalCode?C.t1:C.t3}}>{t.nominalCode||'—'}</span>}
                      </td>}
                      <td style={{...td,maxWidth:130}} onClick={() => canEdit && startEdit(s.id,t.id,'notes',t.notes)}>
                        {isEd(t.id,'notes') ? <EI field="notes"/>
                          : <span title={t.notes} style={{color:t.notes?C.t1:C.t3}}>{t.notes||'—'}</span>}
                      </td>
                      <td style={{...td,textAlign:'center',width:60}}>
                        {t.receipt ? (
                          <div style={{display:'flex',gap:3,justifyContent:'center'}}>
                            <button onClick={() => window.open(t.receipt.url,'_blank')}
                              title={`View: ${t.receipt.filename}`}
                              style={{background:C.grnDim,border:`1px solid ${C.grnBrd}`,borderRadius:5,cursor:'pointer',color:C.grn,fontSize:12,padding:'2px 6px',fontWeight:600}}>📎 View</button>
                            <button onClick={() => dlReceipt(t.receipt, t, s)}
                              title={`Save: ${t.receipt.filename}`}
                              style={{background:C.bluDim,border:`1px solid ${C.bluBrd}`,borderRadius:5,cursor:'pointer',color:C.blu,fontSize:12,padding:'2px 6px',fontWeight:600}}>↓ Save</button>
                          </div>
                        ) : canEdit ? (
                          <button onClick={() => { setReceiptTarget({sid:s.id,tid:t.id}); receiptInputRef.current?.click(); }}
                            title="Attach a receipt (PDF or image) — saved locally, listed in Audit Workbook"
                            style={{background:'none',border:`1px solid ${C.bdr}`,borderRadius:5,cursor:'pointer',color:C.t3,fontSize:11,padding:'2px 8px'}}>+ Attach</button>
                        ) : null}
                      </td>
                      <td style={{...td,textAlign:'center',width:30}}>
                        <button onClick={() => toggleFlag(s.id,t.id)}
                          style={{background:'none',border:'none',cursor:'pointer',color:t.flagged?C.amb:C.t3,fontSize:13,padding:'1px 3px'}}>⚑</button>
                      </td>
                      <td style={{...td,textAlign:'center',width:30}}>
                        {canEdit && <button onClick={() => deleteTx(s.id,t.id)}
                          style={{background:'none',border:'none',cursor:'pointer',color:C.t3,fontSize:12,padding:'1px 3px'}}>✕</button>}
                      </td>
                      <td style={{...td,textAlign:'center',width:30}}>
                        {canEdit && s.editedTransactions && (
                          <button onClick={() => resetRow(s.id,t.id)} title="Reset this row to original AI extraction"
                            style={{background:'none',border:'none',cursor:'pointer',color:C.amb,fontSize:13,padding:'1px 3px'}}>↺</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
            </div>
            {showPdf && (
              <div style={{flex:'0 0 50%',minWidth:0,borderRadius:9,border:`1px solid ${C.bdr}`,overflow:'hidden',background:C.card,display:'flex',flexDirection:'column'}}>
                <div style={{padding:'6px 10px',borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:C.surf}}>
                  <span style={{fontSize:11,fontWeight:600,color:C.t2}}>{s.bankName||s.filename} — Original PDF</span>
                  <button onClick={() => { setShowPdf(false); setSidebarCollapsed(false); setRecCollapsed(false); }}
                    style={{background:'none',border:'none',cursor:'pointer',color:C.t3,fontSize:16,padding:'0 2px',lineHeight:1}}>×</button>
                </div>
                {pdfUrl ? (
                  <object data={pdfUrl} type="application/pdf" style={{width:'100%',flex:1,border:'none'}}>
                    <div style={{padding:20,fontSize:13,color:C.t2}}>Can't show the PDF inline here. <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{color:C.blu,fontWeight:600}}>Open it in a new tab →</a></div>
                  </object>
                ) : <div style={{padding:20,fontSize:13,color:C.t3}}>Loading PDF…</div>}
              </div>
            )}
          </div>
          )}
        </div>
      <input ref={receiptInputRef} type="file" accept="application/pdf,image/*"
        style={{display:'none'}}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && receiptTarget) { attachReceipt(receiptTarget.sid, receiptTarget.tid, file); setReceiptTarget(null); }
          e.target.value = '';
        }}/>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────────────
  const renderSearch = () => (
    <div style={{display:'flex',flexDirection:'column',height:'100%',gap:14}}>
      <div style={{flexShrink:0}}>
        <div style={{fontSize:19,fontWeight:700,color:C.t1,fontFamily:'Inter,sans-serif',marginBottom:3}}>Search All Statements</div>
        <div style={{fontSize:12,color:C.t2}}>Search by payee, description, date, amount, or nominal code across every loaded statement</div>
      </div>
      <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
        placeholder="e.g.  Barclaycard   /   31/01/2024   /   234.50   /   7200"
        style={{width:'100%',padding:'12px 16px',background:C.card,border:`1px solid ${C.bdrBrt}`,
          borderRadius:9,color:C.t1,fontSize:14,outline:'none',fontFamily:'Inter,sans-serif',
          boxSizing:'border-box',flexShrink:0}}/>
      <div style={{fontSize:11,color:C.t3,flexShrink:0}}>
        {searchQ.length < 2
          ? 'Type at least 2 characters'
          : searchResults.length === 0
          ? 'No matching transactions found'
          : `${searchResults.length} result${searchResults.length!==1?'s':''} across ${new Set(searchResults.map(r=>r.stmt.id)).size} statement${new Set(searchResults.map(r=>r.stmt.id)).size!==1?'s':''}`}
      </div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
        {searchResults.map(({stmt,tx}, i) => (
          <div key={i} onClick={() => { setActiveId(stmt.id); setTab('audit'); }}
            style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,
              border:`1px solid ${C.bdr}`,background:C.card,cursor:'pointer',transition:'all 0.12s'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:4}}>
                <TypeTag type={tx.paymentType}/>
                <span style={{fontSize:12,fontWeight:500,color:C.t1}}>{tx.payee||tx.description}</span>
                <span style={{fontSize:11,color:C.t3,fontFamily:'JetBrains Mono,monospace'}}>{tx.date}</span>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:11,color:C.t2}}>{stmt.bankName||stmt.filename}</span>
                {stmt.period && <span style={{fontSize:10,color:C.t3,fontFamily:'JetBrains Mono,monospace'}}>{stmt.period.from}→{stmt.period.to}</span>}
                {tx.description && tx.description !== tx.payee && (
                  <span style={{fontSize:11,color:C.t3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:200}}>{tx.description}</span>
                )}
                {tx.nominalCode && <span style={{fontSize:10,color:C.pur,fontFamily:'JetBrains Mono,monospace'}}>{tx.nominalCode}</span>}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              {tx.debit  != null && <div style={{fontSize:14,fontWeight:600,color:C.red, fontFamily:'JetBrains Mono,monospace'}}>{fmtCcy(tx.debit)}</div>}
              {tx.credit != null && <div style={{fontSize:14,fontWeight:600,color:C.grn, fontFamily:'JetBrains Mono,monospace'}}>{fmtCcy(tx.credit)}</div>}
            </div>
            <div style={{fontSize:10,color:C.t3,flexShrink:0}}>→ View</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────
  const renderQboImportModal = () => {
    if (!qboImportRows) return null;
    const filledCount = qboImportRows.filter(r => r.nominalCode).length;
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.48)',zIndex:200,
        display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.card,borderRadius:12,padding:24,width:'min(820px,96vw)',
          maxHeight:'85vh',display:'flex',flexDirection:'column',gap:14,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
          {/* Header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.t1}}>Import QBO Bank Rules</div>
              <div style={{fontSize:12,color:C.t2,marginTop:4,lineHeight:1.5}}>
                {qboImportRows.length} rules found · QBO categories pre-filled — edit to override with nominal codes, or leave as-is and import
              </div>
            </div>
            <button onClick={() => setQboImportRows(null)}
              style={{...btn('outline'),padding:'5px 11px',fontSize:13,flexShrink:0}}>✕</button>
          </div>
          {/* Column headers */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 130px',gap:8,padding:'6px 10px',
            background:C.bg,borderRadius:7,fontSize:11,fontWeight:600,color:C.t3,
            textTransform:'uppercase',letterSpacing:'0.05em',flexShrink:0}}>
            <div>Payee / Bank keyword</div>
            <div>QBO category (pre-filled)</div>
            <div>Account Category / Nominal Code</div>
          </div>
          {/* Rows */}
          <div style={{overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:4}}>
            {qboImportRows.map((row, i) => (
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 130px',gap:8,
                padding:'7px 10px',background:i%2===0?C.surf:C.card,borderRadius:6,alignItems:'center'}}>
                <div style={{fontSize:12,color:C.t1,fontWeight:500}}>{row.payeeName || row.keyword}</div>
                <div style={{fontSize:11,color:C.t3,fontStyle:'italic',lineHeight:1.4}}>{row.qboCategory}</div>
                <input
                  value={row.nominalCode}
                  onChange={ev => setQboImportRows(prev => prev.map((r,j) =>
                    j===i ? {...r, nominalCode: ev.target.value.trim()} : r))}
                  placeholder="Category or nominal code"
                  style={{border:`1px solid ${row.nominalCode ? C.grnBrd : C.bdrBrt}`,
                    borderRadius:6,padding:'5px 8px',fontSize:12,
                    fontFamily:'JetBrains Mono,monospace',width:'100%',boxSizing:'border-box',
                    background: row.nominalCode ? C.grnDim : C.card,outline:'none'}}
                />
              </div>
            ))}
          </div>
          {/* Footer */}
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',alignItems:'center',
            borderTop:`1px solid ${C.bdr}`,paddingTop:12,flexShrink:0}}>
            <div style={{fontSize:12,color:C.t3,flex:1}}>
              {filledCount > 0
                ? <span style={{color:C.grn,fontWeight:600}}>{filledCount} of {qboImportRows.length} rules ready to import</span>
                : <span>Assign at least one nominal code to import</span>}
            </div>
            <button onClick={() => setQboImportRows(null)} style={btn('outline')}>Cancel</button>
            <button
              disabled={filledCount === 0}
              onClick={() => {
                const toAdd = {};
                qboImportRows.filter(r => r.nominalCode).forEach(r => {
                  toAdd[normKey(r.payeeName || r.keyword, '')] = r.nominalCode;
                });
                setPayeeMemory(prev => ({...prev, ...toAdd}));
                setQboImportRows(null);
              }}
              style={btn('primary', filledCount === 0)}>
              ↑ Import {filledCount} rule{filledCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderExport = () => {
    const approved   = stmts.filter(s => s.status === 'approved');
    const qboApproved  = approved.filter(s => s.platform === 'qbo');
    const xeroApproved = approved.filter(s => s.platform === 'xero');
    const totalTx    = approved.reduce((n,s) => n + getTx(s).length, 0);
    const totalDeb   = approved.reduce((n,s) => n + (s.reconciliation?.csvDebitTotal  || 0), 0);
    const totalCred  = approved.reduce((n,s) => n + (s.reconciliation?.csvCreditTotal || 0), 0);

    if (!approved.length) return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:14,color:C.t2}}>
        <div style={{fontSize:40}}>📥</div>
        <div style={{fontSize:16,color:C.t1}}>No approved statements yet</div>
        <button onClick={() => setTab('audit')} style={btn('primary')}>Go to Audit</button>
      </div>
    );

    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%',gap:16,overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{fontSize:19,fontWeight:700,color:C.t1,fontFamily:'Inter,sans-serif'}}>Export to Accounting Platform</div>
            <div style={{fontSize:12,color:C.t2,marginTop:3}}>{approved.length} statement{approved.length!==1?'s':''} approved · {totalTx} transactions ready</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            {qboApproved.length > 1 && (
              <Tip text="Combine all approved QBO statements into a single CSV file for one import into QuickBooks." pos="bottom" active={showTips}>
              <button onClick={() => dlFile(buildQBO(qboApproved.flatMap(s=>getTx(s)).sort((a,b)=>pDate(a.date)-pDate(b.date))), 'Merged_QBO.csv')}
                style={btn('outline')}>↓ Merge QBO ({qboApproved.length})</button>
              </Tip>
            )}
            {xeroApproved.length > 1 && (
              <Tip text="Combine all approved Xero statements into a single CSV file for one import into Xero." pos="bottom" active={showTips}>
              <button onClick={() => dlFile(buildXero(xeroApproved.flatMap(s=>getTx(s)).sort((a,b)=>pDate(a.date)-pDate(b.date))), 'Merged_Xero.csv')}
                style={btn('outline')}>↓ Merge Xero ({xeroApproved.length})</button>
              </Tip>
            )}
          </div>
        </div>

        <div style={{flexShrink:0,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[
            {label:'Total Transactions', val:totalTx,        color:C.t1},
            {label:'Total Debits',       val:fmtCcy(totalDeb), color:C.red},
            {label:'Total Credits',      val:fmtCcy(totalCred),color:C.grn},
          ].map(({label,val,color}) => (
            <div key={label} style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:C.t3,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7,fontFamily:'Inter,sans-serif'}}>{label}</div>
              <div style={{fontSize:22,fontWeight:700,color,fontFamily:'JetBrains Mono,monospace'}}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
          {approved.map(s => {
            const rec     = s.reconciliation;
            const platCol = s.platform==='xero'?'#13B5EA':'#2CA01C';
            const platLbl = s.platform==='xero'?'Xero':'QBO';
            const atCfg   = ACCOUNT_TYPES[s.accountType]||ACCOUNT_TYPES.current;
            return (
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                background:C.card,border:`1px solid ${C.bdr}`,borderRadius:9}}>
                <div style={{width:3,height:36,borderRadius:2,background:atCfg.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.t1,marginBottom:2}}>{s.bankName} — {atCfg.label}</div>
                  <div style={{fontSize:11,color:C.t2}}>
                    {s.period?.from} – {s.period?.to} · {getTx(s).length} txn · D:{fmtCcy(rec?.csvDebitTotal)} C:{fmtCcy(rec?.csvCreditTotal)}
                  </div>
                  <div style={{fontSize:10,color:C.t3,marginTop:2,fontFamily:'JetBrains Mono,monospace'}}>{makeName(s)}</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  <ConfidenceBadge score={s.confidenceScore}/>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,color:platCol,background:`${platCol}14`,border:`1px solid ${platCol}28`}}>{platLbl}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,
                    color:rec?.reconciled?C.grn:C.amb,
                    background:rec?.reconciled?C.grnDim:C.ambDim,
                    border:`1px solid ${rec?.reconciled?C.grnBrd:C.ambBrd}`}}>
                    {rec?.reconciled?'✓ Reconciled':'⚑ Variance'}
                  </span>
                  <Tip text="Re-download the approved CSV for this statement." pos="top" active={showTips}>
                  <button onClick={() => exportStmt(s)} style={btn('primary')}>↓ Download</button>
                  </Tip>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payee memory management */}
        <div style={{flexShrink:0,background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:9,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.t1}}>Payee Code Memory</div>
              <div style={{fontSize:11,color:C.t2,marginTop:2}}>
                {Object.keys(payeeMemory).length} rule{Object.keys(payeeMemory).length!==1?'s':''} stored · auto-fills Nominal Code on next import
              </div>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
              <Tip text="Save your current payee rules as a JSON backup file. Keep this somewhere safe — it's your only recovery if browser storage is cleared." pos="top" active={showTips}>
              <button onClick={exportRules} disabled={!Object.keys(payeeMemory).length} style={btn('outline')}>↓ Save Rules</button>
              </Tip>
              <Tip text="Load a previously saved rules backup (.json). Restores payee memory, chart of accounts, and coding preferences." pos="top" active={showTips}>
              <button onClick={() => rulesInputRef.current?.click()} style={btn('outline')}>↑ Import Rules (.json)</button>
              </Tip>
              <Tip text="Import rules exported from QuickBooks Online (Transactions → Bank Transactions → Rules → Export Rules)." pos="top" active={showTips}>
              <button onClick={() => qboInputRef.current?.click()} style={btn('outline')}>↑ Import QBO Rules (.xls)</button>
              </Tip>
              <button onClick={() => { if(window.confirm('Clear all payee→code rules?')) setPayeeMemory({}); }}
                disabled={!Object.keys(payeeMemory).length} style={btn('danger')}>Clear All</button>
              <input ref={rulesInputRef} type="file" accept=".json" style={{display:'none'}} onChange={importRules}/>
              <input ref={qboInputRef}   type="file" accept=".xls,.xlsx" style={{display:'none'}} onChange={importRulesQBO}/>
            </div>
          </div>
          {/* Backup help panel */}
          <div style={{background:'#FFF3CD',border:'2px solid #F5A623',borderRadius:8,padding:'12px 16px',lineHeight:1.6}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontSize:18,lineHeight:1}}>⚠️</span>
              <span style={{fontSize:13,fontWeight:700,color:'#92400E'}}>Backup your rules — do this now</span>
            </div>
            <div style={{fontSize:12,color:'#78350F',marginBottom:6}}>
              <strong>Rules live in this browser only</strong> (OneDrive Practice Workspace users: rules also sync to your shared folder — manual backups are still recommended as a secondary copy). Clear your browser data or switch devices and they are gone permanently unless backed up or synced.
            </div>
            <div style={{fontSize:11,color:'#92400E',lineHeight:1.6}}>
              A backup file downloads automatically each time you Approve.{' '}
              <strong>Move that file to OneDrive, Google Drive, or iCloud Drive after every session</strong> — it is your only recovery if localStorage is wiped.
              <br/>To restore: click <em>Import Rules (.json)</em> and select your backup file.
              To import QBO rules: <em>Transactions → Bank Transactions → Rules → Export Rules</em>, then <em>Import QBO Rules (.xls)</em>.
            </div>
          </div>
        </div>

        {/* Import guides */}
        <div style={{flexShrink:0,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[
            { title:'QuickBooks Online', color:'#2CA01C', steps:[
              'Banking → Upload transactions → Select bank account',
              'Upload CSV — QBO auto-detects column layout',
              'Map: Date · Payment Type · Description · Payee · Debit · Credit · Category · Nominal Code · Notes',
              'Review auto-matched transactions against existing bank rules',
              'Accept matches, categorise new transactions, click Add All',
            ]},
            { title:'Xero', color:'#13B5EA', steps:[
              'Accounting → Bank Accounts → Select account → Import Statement',
              'Upload CSV — Xero reads Date, Amount, Payee, Description',
              'Amount: negative = money out, positive = money in',
              'Reference column carries the payment type (DD, SO, BACS). Analysis Code carries the nominal code from payee memory — visible in Xero as a bank reference, not an account code',
              'To post directly to account codes, use ✎ Code & Create — confirm a code per line, then export a precoded CSV with Account Code, Tax Rate (VAT/GST) and Tracking columns',
              'Review matches against rules, accept and post',
            ]},
          ].map(({title,color,steps}) => (
            <div key={title} style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:9,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>{title} Import Steps</div>
              {steps.map((step,i) => (
                <div key={i} style={{display:'flex',gap:9,marginBottom:7,fontSize:12,color:C.t2,alignItems:'flex-start'}}>
                  <span style={{color,fontFamily:'JetBrains Mono,monospace',fontWeight:700,fontSize:10,
                    background:`${color}14`,border:`1px solid ${color}28`,borderRadius:4,
                    padding:'1px 6px',flexShrink:0,marginTop:1}}>{i+1}</span>
                  <span style={{lineHeight:1.5}}>{step}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const fmtDate = ts => { const d = new Date(ts); return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); };
    return (
      <div style={{padding:'22px 28px',overflowY:'auto',height:'100%',boxSizing:'border-box'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <div style={{fontSize:19,fontWeight:700,color:C.t1}}>Projects</div>
            <div style={{fontSize:12,color:C.t2,marginTop:3}}>
              {projects.length} project{projects.length!==1?'s':''} · click a card to switch and review
            </div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16}}>
          {projects.map(p => {
            const pStmts  = stmts.filter(s => (s.projectId||'default') === p.id);
            const approved = pStmts.filter(s => s.status === 'approved').length;
            const review   = pStmts.filter(s => s.status === 'review').length;
            const errored  = pStmts.filter(s => s.status === 'error').length;
            const queued   = pStmts.filter(s => ['queued','processing'].includes(s.status)).length;
            const lastAt   = pStmts.reduce((m,s) => Math.max(m,s.approvedAt||s.extractedAt||0), 0);
            const isActive = p.id === activeProjectId;
            return (
              <div key={p.id}
                onClick={() => { setActiveProjectId(p.id); localStorage.setItem('sa_activeProject',p.id); setTab('audit'); }}
                style={{background:isActive?C.bluDim:C.card,border:`1px solid ${isActive?C.bluBrd:C.bdr}`,
                  borderRadius:12,padding:'18px 20px',cursor:'pointer',
                  transition:'all 0.15s',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{fontSize:15,fontWeight:700,color:isActive?C.blu:C.t1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{p.name}</div>
                  {isActive && <span style={{fontSize:10,fontWeight:700,color:C.blu,background:C.bluDim,border:`1px solid ${C.bluBrd}`,borderRadius:4,padding:'1px 6px',flexShrink:0,marginLeft:6}}>Active</span>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:3,marginBottom:10}}>
                  {approved > 0 && <span style={{fontSize:12,color:C.grn}}>✓ {approved} approved</span>}
                  {review   > 0 && <span style={{fontSize:12,color:C.blu}}>⚑ {review} for review</span>}
                  {errored  > 0 && <span style={{fontSize:12,color:C.red}}>⚠ {errored} error{errored!==1?'s':''}</span>}
                  {queued   > 0 && <span style={{fontSize:12,color:C.t3}}>◷ {queued} queued</span>}
                  {pStmts.length === 0 && <span style={{fontSize:12,color:C.t4}}>No statements yet</span>}
                </div>
                {lastAt > 0 && <div style={{fontSize:11,color:C.t4}}>Last activity: {fmtDate(lastAt)}</div>}
              </div>
            );
          })}
          <div
            onClick={() => {
              const name = window.prompt('New project name:');
              if (!name?.trim()) return;
              const id = uid();
              const updated = [...projects, {id, name: name.trim()}];
              setProjects(updated);
              localStorage.setItem('sa_projects', JSON.stringify(updated));
              setActiveProjectId(id);
              localStorage.setItem('sa_activeProject', id);
            }}
            style={{background:C.surf,border:`2px dashed ${C.bdrBrt}`,borderRadius:12,
              padding:'18px 20px',cursor:'pointer',display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',gap:6,color:C.t3,
              transition:'all 0.15s',minHeight:100}}>
            <div style={{fontSize:24}}>+</div>
            <div style={{fontSize:13}}>New Project</div>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────────────
  const navItems = [
    {id:'upload', n:'1', label:'Upload',  badge:null},
    {id:'queue',  n:'2', label:'Process', badge:stmts.length||null},
    {id:'audit',  n:'3', label:'Review',  badge:cnts.review||null},
    {id:'export', n:'4', label:'Export',  badge:cnts.approved||null},
    {id:'dash',   n:'◈', label:'Projects',badge:projects.length>1?projects.length:null},
  ];
  const stepDone = id => {
    const order = ['upload','queue','audit','export'];
    if (id==='upload') return stmts.length>0;
    if (id==='queue')  return stmts.some(s=>!['queued','processing'].includes(s.status));
    if (id==='audit')  return cnts.approved>0;
    return false;
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,
      color:C.t1,fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden'}}>

      {/* Topbar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 28px',
        borderBottom:`1px solid ${C.bdr}`,flexShrink:0,background:C.card}}>
        <div style={{display:'flex',alignItems:'center',gap:13}}>
          <div style={{width:40,height:40,borderRadius:10,background:C.blu,display:'flex',
            alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:19}}>£</div>
          <div>
            <div style={{fontSize:19,fontWeight:700,color:C.t1,letterSpacing:'-0.01em'}}>StatementAudit Pro</div>
            <div style={{fontSize:13,color:C.t3}}>Bank statement audit &amp; reconciliation → QuickBooks, Xero &amp; Excel</div>
          </div>
          {TRIAL_MODE && (
            <div style={{marginLeft:8,display:'flex',alignItems:'center',gap:8,padding:'5px 12px',
              borderRadius:8,background:trialUsed >= TRIAL_LIMIT ? C.redDim : C.ambDim,
              border:`1px solid ${trialUsed >= TRIAL_LIMIT ? C.redBrd : C.ambBrd}`}}>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',
                color: trialUsed >= TRIAL_LIMIT ? C.red : C.amb}}>TRIAL</span>
              <span style={{fontSize:12,color:C.t2}}>
                {trialUsed >= TRIAL_LIMIT
                  ? 'Limit reached — contact us to upgrade'
                  : `${TRIAL_LIMIT - trialUsed} of ${TRIAL_LIMIT} statement${TRIAL_LIMIT !== 1 ? 's' : ''} remaining`}
              </span>
              {trialUsed >= TRIAL_LIMIT && (
                <button onClick={() => setShowTrialCap(true)}
                  style={{fontSize:11,fontWeight:600,color:C.red,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
                  Upgrade →
                </button>
              )}
            </div>
          )}
        </div>
        <nav style={{display:'flex',gap:8}}>
          {navItems.map(n => {
            const on   = tab===n.id;
            const done = stepDone(n.id);
            const tabTip = {
              upload: 'Step 1 — Drop PDF bank statements here. Set Account Type, Export To, and Tax Jurisdiction before uploading.',
              queue:  'Step 2 — Run the AI extraction engine on your queued files. Each PDF is read, transactions extracted, and reconciled.',
              audit:  'Step 3 — Check, edit, and approve each extracted statement. Numbers must close before anything exports.',
              export: 'Step 4 — Download approved statements as CSV files for QuickBooks or Xero. Access the Audit Workbook here too.',
              dash:   'Projects dashboard — view all projects, statement counts, and last activity. Click a card to switch projects.',
            }[n.id];
            return (
              <Tip key={n.id} text={tabTip} pos="bottom" active={showTips}>
              <button onClick={() => setTab(n.id)}
                style={{display:'flex',alignItems:'center',gap:9,padding:'9px 16px',borderRadius:10,
                  background:on?C.bluDim:'transparent',
                  border:`1px solid ${on?C.bluBrd:'transparent'}`,
                  color:on?C.blu:C.t2,cursor:'pointer',fontSize:14,fontWeight:on?600:500,
                  fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
                <span style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:13,fontWeight:600,flexShrink:0,
                  background:on?C.blu:done?C.grnDim:'#EEF1F6',
                  color:on?'#fff':done?C.grn:C.t3}}>{done&&!on?'✓':n.n}</span>
                <span>{n.label}</span>
                {n.badge > 0 && (
                  <span style={{background:on?C.blu:C.t3,color:'#fff',borderRadius:10,padding:'0 7px',
                    fontSize:12,fontWeight:600,lineHeight:'18px'}}>{n.badge}</span>
                )}
              </button>
              </Tip>
            );
          })}
          <Tip text="A log of every extraction, approval, rejection, and cloud save this session." pos="bottom" active={showTips}>
          <button onClick={() => setShowActivity(v => !v)}
            title="Activity log"
            style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,
              background:showActivity?C.bluDim:'transparent',border:`1px solid ${showActivity?C.bluBrd:'transparent'}`,
              color:showActivity?C.blu:C.t2,cursor:'pointer',fontSize:14,fontWeight:500,fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
            ⧖ Activity
          </button>
          </Tip>
          <Tip text={cloudProvider!=='none' ? 'Cloud storage is connected. Microsoft users can also create or join a shared Practice Workspace.' : 'Connect Google Drive or OneDrive to auto-save approved statements. Microsoft users can create a shared Practice Workspace.'} pos="bottom" active={showTips}>
          <button onClick={() => { setShowCloud(v => !v); setCloudError(null); }}
            title="Cloud storage — Google Drive or OneDrive"
            style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,
              background:showCloud?C.bluDim:cloudProvider!=='none'?C.grnDim:'transparent',
              border:`1px solid ${showCloud?C.bluBrd:cloudProvider!=='none'?C.grnBrd:'transparent'}`,
              color:showCloud?C.blu:cloudProvider!=='none'?C.grn:C.t2,
              cursor:'pointer',fontSize:14,fontWeight:500,fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
            {cloudSyncing ? '↻ Syncing' : cloudProvider !== 'none' ? '☁ Synced' : '☁ Cloud'}
          </button>
          </Tip>
          <Tip text="Step-by-step guides, troubleshooting, and import instructions for QuickBooks and Xero." pos="bottom" active={showTips}>
          <button onClick={() => setShowHelp(v => !v)}
            title="Help & guides"
            style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,
              background:showHelp?C.bluDim:'transparent',border:`1px solid ${showHelp?C.bluBrd:'transparent'}`,
              color:showHelp?C.blu:C.t2,cursor:'pointer',fontSize:14,fontWeight:500,fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
            ? Help
          </button>
          </Tip>
          <Tip text="Send a message, report a bug, or suggest a feature." pos="bottom" active={showTips}>
          <button onClick={() => { setShowFeedback(v => !v); setFeedbackSent(false); }}
            title="Give feedback"
            style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,
              background:showFeedback?C.bluDim:'transparent',border:`1px solid ${showFeedback?C.bluBrd:'transparent'}`,
              color:showFeedback?C.blu:C.t2,cursor:'pointer',fontSize:14,fontWeight:500,fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
            💬 Feedback
          </button>
          </Tip>
          <Tip text="Toggle Guide Mode — hover over any button or tab to see what it does." pos="bottom" active={showTips}>
          <button onClick={() => setShowTips(v => !v)}
            title="Toggle guide mode tooltips"
            style={{display:'flex',alignItems:'center',gap:5,padding:'9px 12px',borderRadius:10,
              background:showTips?C.grnDim:'transparent',border:`1px solid ${showTips?C.grnBrd:'transparent'}`,
              color:showTips?C.grn:C.t3,cursor:'pointer',fontSize:13,fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
            💡{showTips?' Guide on':' Guide'}
          </button>
          </Tip>
          <Tip text="Keyboard shortcuts: A = Approve, R = Reject, ← → = navigate statements, ? = show shortcuts." pos="bottom" active={showTips}>
          <button onClick={() => setShowShortcuts(v => !v)}
            title="Keyboard shortcuts"
            style={{padding:'9px 12px',borderRadius:10,background:'transparent',border:`1px solid transparent`,
              color:C.t3,cursor:'pointer',fontSize:16,fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}>
            ⌨
          </button>
          </Tip>
        </nav>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'hidden',padding:tab==='audit'?'22px 22px 22px 0':tab==='dash'?0:22}}>
        {tab==='upload' && renderUpload()}
        {tab==='queue'  && renderQueue()}
        {tab==='audit'  && renderAudit()}
        {tab==='export' && renderExport()}
        {tab==='dash'   && renderDashboard()}
      </div>
      {renderQboImportModal()}

      {/* Activity log panel */}
      {showActivity && (() => {
        const EVENT_CFG = {
          extracted: {label:'Extracted',  color:C.blu,  icon:'⟳'},
          approved:  {label:'Approved',   color:C.grn,  icon:'✓'},
          exported:  {label:'Exported',   color:C.grn,  icon:'↓'},
          rejected:  {label:'Rejected',   color:C.red,  icon:'✕'},
        };
        const events = stmts.flatMap(stmt => [
          stmt.extractedAt && {ts:stmt.extractedAt, type:'extracted', stmt},
          stmt.approvedAt  && {ts:stmt.approvedAt,  type:'approved',  stmt},
          stmt.exportedAt  && {ts:stmt.exportedAt,  type:'exported',  stmt},
          stmt.rejectedAt  && {ts:stmt.rejectedAt,  type:'rejected',  stmt},
        ].filter(Boolean)).sort((a,b) => b.ts - a.ts);
        return (
          <div onClick={() => setShowActivity(false)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:900,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}}>
            <div onClick={e => e.stopPropagation()}
              style={{width:400,maxWidth:'95vw',height:'100vh',background:C.card,borderLeft:`1px solid ${C.bdr}`,display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,0.2)'}}>
              <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0,background:C.surf}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:17,fontWeight:700,color:C.t1}}>Activity Log</div>
                    <div style={{fontSize:12,color:C.t3,marginTop:2}}>This session only — {events.length} event{events.length!==1?'s':''}</div>
                  </div>
                  <button onClick={() => setShowActivity(false)}
                    style={{background:'none',border:`1px solid ${C.bdr}`,borderRadius:8,color:C.t3,fontSize:18,cursor:'pointer',width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'12px 24px'}}>
                {events.length === 0 ? (
                  <div style={{textAlign:'center',color:C.t3,fontSize:13,marginTop:40}}>No activity yet — process a statement to get started.</div>
                ) : events.map((ev,i) => {
                  const cfg = EVENT_CFG[ev.type];
                  const proj = projects.find(p => p.id === (ev.stmt.projectId||'default'));
                  return (
                    <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'10px 0',borderBottom:`1px solid ${C.bdr}`}}>
                      <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',background:cfg.color,marginTop:1}}>{cfg.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.t1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {ev.stmt.bankName||ev.stmt.filename}
                        </div>
                        <div style={{fontSize:11,color:C.t3,marginTop:1}}>
                          {cfg.label}
                          {ev.stmt.period && ` · ${ev.stmt.period.from} – ${ev.stmt.period.to}`}
                          {proj && projects.length > 1 && ` · ${proj.name}`}
                        </div>
                      </div>
                      <div style={{fontSize:11,color:C.t3,flexShrink:0,whiteSpace:'nowrap'}}>{fmtTime(ev.ts)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{padding:'14px 24px',borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
                <div style={{fontSize:11,color:C.t4,textAlign:'center',lineHeight:1.5}}>
                  Activity reflects this browser session.<br/>
                  {cloudProvider !== 'none' ? `Approved statements auto-save to ${CLOUD_CFG[cloudProvider].label}.` : 'Connect ☁ Cloud to persist statements across devices.'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div onClick={() => setShowShortcuts(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:14,padding:'28px 32px',width:360,maxWidth:'90vw',boxShadow:'0 12px 40px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:700,color:C.t1}}>Keyboard shortcuts</div>
              <button onClick={() => setShowShortcuts(false)} style={{background:'none',border:'none',color:C.t3,fontSize:18,cursor:'pointer',padding:0}}>×</button>
            </div>
            {[
              ['A','Approve &amp; export current statement'],
              ['R','Reject current statement'],
              ['← →','Navigate between statements'],
              ['?','Toggle this overlay'],
            ].map(([k,d]) => (
              <div key={k} style={{display:'flex',alignItems:'center',gap:12,padding:'7px 0',borderBottom:`1px solid ${C.bdr}`}}>
                <kbd style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:5,padding:'2px 9px',fontSize:13,fontWeight:600,color:C.t1,fontFamily:'JetBrains Mono,monospace',minWidth:32,textAlign:'center',flexShrink:0}}>{k}</kbd>
                <span style={{fontSize:13,color:C.t2}} dangerouslySetInnerHTML={{__html:d}}/>
              </div>
            ))}
            <div style={{fontSize:11,color:C.t4,marginTop:14}}>Shortcuts active in Review tab when no input is focused.</div>
          </div>
        </div>
      )}

      {/* Cloud storage panel */}
      {showCloud && (
        <div onClick={() => setShowCloud(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:900,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}}>
          <div onClick={e => e.stopPropagation()}
            style={{width:420,maxWidth:'95vw',height:'100vh',background:C.card,borderLeft:`1px solid ${C.bdr}`,
              display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,0.2)'}}>
            {/* Header */}
            <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0,
              background: cloudProvider === 'google' ? '#4285F4' : cloudProvider === 'microsoft' ? '#0078D4' : C.blu}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:'#fff'}}>Cloud Storage</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.75)',marginTop:2}}>
                    {cloudProvider !== 'none'
                      ? `Connected to ${CLOUD_CFG[cloudProvider].label}`
                      : 'Your files, your storage — zero server cost'}
                  </div>
                </div>
                <button onClick={() => setShowCloud(false)}
                  style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:20,cursor:'pointer',
                    width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
              {cloudProvider === 'none' ? (
                <>
                  <p style={{fontSize:13,color:C.t2,lineHeight:1.6,marginTop:0,marginBottom:20}}>
                    Connect your own cloud to save approved statements automatically.
                    Files are stored in your account — StatementAudit Pro never sees them.
                  </p>

                  {/* Connect buttons */}
                  <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
                    <button onClick={() => startCloudAuth('google')}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:10,
                        border:`1px solid #E3E8EF`,background:'#fff',cursor:'pointer',
                        fontSize:14,fontWeight:600,color:C.t1,width:'100%',transition:'border-color 0.15s'}}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#4285F4'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#E3E8EF'}>
                      <span style={{fontSize:20}}>📁</span>
                      <span>Connect Google Drive</span>
                      <span style={{marginLeft:'auto',fontSize:11,color:C.t3}}>→</span>
                    </button>
                    <button onClick={() => startCloudAuth('microsoft')}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:10,
                        border:`1px solid #E3E8EF`,background:'#fff',cursor:'pointer',
                        fontSize:14,fontWeight:600,color:C.t1,width:'100%',transition:'border-color 0.15s'}}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#0078D4'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#E3E8EF'}>
                      <span style={{fontSize:20}}>🗂</span>
                      <span>Connect OneDrive</span>
                      <span style={{marginLeft:'auto',fontSize:11,color:C.t3}}>→</span>
                    </button>
                  </div>

                  {cloudError && (
                    <div style={{background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:8,
                      padding:'10px 14px',fontSize:12,color:C.red,marginBottom:16}}>{cloudError}</div>
                  )}

                  {/* How it works */}
                  <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'14px 16px',marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>How it works</div>
                    {[
                      ['☁', 'Approved statements auto-save as JSON to a private app folder'],
                      ['↩', 'Reconnecting restores all your previous statements'],
                      ['🔒', 'Files stay in your account — we never store or see them'],
                      ['👥', 'Share the folder with colleagues for team access'],
                    ].map(([icon, text]) => (
                      <div key={text} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
                        <span style={{fontSize:14,lineHeight:'20px',flexShrink:0}}>{icon}</span>
                        <span style={{fontSize:13,color:C.t2,lineHeight:1.5}}>{text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Setup instructions — expandable per provider */}
                  {[
                    { provider:'google', label:'Google Drive', color:'#4285F4', icon:'📁', steps:[
                      'Go to console.cloud.google.com and sign in.',
                      'Click "Select a project" → New Project → name it (e.g. StatementAudit Pro) → Create.',
                      'Left menu: APIs & Services → Library → search "Google Drive API" → Enable.',
                      'APIs & Services → OAuth consent screen → External → fill in App name + your email → Save and Continue through all steps.',
                      'APIs & Services → Credentials → + Create Credentials → OAuth client ID.',
                      'Application type: Web application. Under "Authorised redirect URIs" add your exact app URL (e.g. https://your-app.onrender.com) — no trailing slash.',
                      'Click Create. Copy the Client ID (ends in .apps.googleusercontent.com).',
                      'In Render dashboard → your service → Environment → add variable VITE_GOOGLE_CLIENT_ID = (paste Client ID) → Save. Render rebuilds automatically.',
                    ]},
                    { provider:'microsoft', label:'OneDrive', color:'#0078D4', icon:'🗂', steps:[
                      'Go to portal.azure.com and sign in with your Microsoft account.',
                      'Search "App registrations" in the top bar → + New registration.',
                      'Name: StatementAudit Pro. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts (e.g. Skype, Xbox)".',
                      'Redirect URI: select Web from the dropdown and enter your exact app URL (e.g. https://your-app.onrender.com) → Register.',
                      'On the Overview page, copy the Application (client) ID (a GUID like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
                      'Left menu: API permissions → + Add a permission → Microsoft Graph → Delegated permissions → search and tick Files.ReadWrite and User.Read → Add permissions (Files.ReadWrite is needed for the shared workspace feature; Files.ReadWrite.AppFolder will not work).',
                      'If a "Grant admin consent" button appears, click it (required for organisation accounts; not needed for personal Microsoft accounts).',
                      'In Render dashboard → your service → Environment → add variable VITE_MICROSOFT_CLIENT_ID = (paste the GUID) → Save. Render rebuilds automatically.',
                    ]},
                  ].map(({ provider, label, color, icon, steps }) => (
                    <details key={provider} style={{marginBottom:10,borderRadius:10,border:`1px solid ${C.bdr}`,overflow:'hidden'}}>
                      <summary style={{padding:'11px 14px',background:C.surf,cursor:'pointer',
                        display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:C.t1,listStyle:'none',userSelect:'none'}}>
                        <span style={{fontSize:15}}>{icon}</span>
                        <span style={{flex:1}}>Setup: {label}</span>
                        <span style={{fontSize:10,color:C.t3,fontWeight:400}}>click to expand ▾</span>
                      </summary>
                      <div style={{padding:'12px 14px',background:C.card}}>
                        <div style={{fontSize:11,color:C.t3,marginBottom:10,lineHeight:1.5}}>
                          One-time setup in your {label === 'Google Drive' ? 'Google Cloud Console' : 'Azure Portal'}.
                          Takes about 5 minutes.
                        </div>
                        {steps.map((step, i) => (
                          <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:9}}>
                            <span style={{width:20,height:20,borderRadius:'50%',background:color,color:'#fff',
                              fontSize:10,fontWeight:700,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                              marginTop:1}}>{i+1}</span>
                            <span style={{fontSize:12,color:C.t2,lineHeight:1.55}}>{step}</span>
                          </div>
                        ))}
                        <div style={{marginTop:10,padding:'8px 10px',background:C.bluDim,border:`1px solid ${C.bluBrd}`,
                          borderRadius:7,fontSize:11,color:C.blu,lineHeight:1.5}}>
                          After saving the Render env variable, wait ~2 minutes for the rebuild, then the Connect button will work.
                        </div>
                      </div>
                    </details>
                  ))}
                </>
              ) : (
                <>
                  {/* Connected state header */}
                  <div style={{background:cloudProvider==='google'?'#E8F0FE':'#E6F2FB',border:`1px solid ${cloudProvider==='google'?'#C2D8FB':'#B8DCFB'}`,
                    borderRadius:10,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:cloudProvider==='google'?'#4285F4':'#0078D4',
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#fff',flexShrink:0}}>
                      {cloudProvider === 'google' ? '📁' : '🗂'}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{cloudUser?.name || CLOUD_CFG[cloudProvider].label}</div>
                      <div style={{fontSize:11,color:C.t3,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cloudUser?.email || 'Connected'}</div>
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:cloudProvider==='google'?'#4285F4':'#0078D4',flexShrink:0}}>
                      {cloudSyncing ? '↻ Syncing…' : '✓ Active'}
                    </div>
                  </div>

                  <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'12px 16px',marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Storage</div>
                    {[
                      ['Approved & saved', stmts.filter(s => s.cloudSaved).length],
                      ['Approved, pending save', stmts.filter(s => s.status==='approved' && !s.cloudSaved).length],
                    ].map(([label, count]) => (
                      <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${C.bdr}`}}>
                        <span style={{fontSize:12,color:C.t2}}>{label}</span>
                        <span style={{fontSize:12,fontWeight:600,color:C.t1}}>{count}</span>
                      </div>
                    ))}
                  </div>

                  {/* M365 Workspace section (Microsoft only) */}
                  {cloudProvider === 'microsoft' && (
                    <div style={{border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden',marginBottom:16}}>
                      <div style={{padding:'11px 14px',background:workspaceMode==='active'?'#E6F2FB':C.surf,
                        display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:15}}>👥</span>
                        <span style={{fontSize:13,fontWeight:700,color:C.t1,flex:1}}>
                          {workspaceMode==='active' ? workspaceName : 'Practice Workspace'}
                        </span>
                        {workspaceMode==='active' && (
                          <span style={{fontSize:11,fontWeight:600,color:'#0078D4'}}>
                            {workspaceSyncing ? '↻ Syncing…' : '✓ Active'}
                          </span>
                        )}
                      </div>

                      <div style={{padding:'12px 14px',background:C.card}}>
                        {workspaceMode !== 'active' ? (
                          <>
                            <p style={{fontSize:12,color:C.t2,lineHeight:1.6,margin:'0 0 12px'}}>
                              A workspace is a shared OneDrive folder. All colleagues who join
                              the same workspace share payee memory, chart of accounts, and
                              tracking categories — no duplicate setup across the team.
                            </p>

                            {workspaceError && (
                              <div style={{background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:7,
                                padding:'8px 12px',fontSize:12,color:C.red,marginBottom:12}}>{workspaceError}</div>
                            )}

                            {wsView === 'none' && (
                              <div style={{display:'flex',gap:8}}>
                                <button onClick={() => { setWsView('create'); setWorkspaceError(null); }}
                                  style={{flex:1,padding:'9px 12px',borderRadius:8,border:`1px solid #0078D4`,
                                    background:'#0078D4',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                                  + Create workspace
                                </button>
                                <button onClick={() => { setWsView('join'); setWorkspaceError(null); }}
                                  style={{flex:1,padding:'9px 12px',borderRadius:8,border:`1px solid ${C.bdr}`,
                                    background:C.surf,color:C.t1,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                                  Join workspace
                                </button>
                              </div>
                            )}

                            {wsView === 'create' && (
                              <div>
                                <div style={{fontSize:11,color:C.t3,marginBottom:8,lineHeight:1.5}}>
                                  Creates a new folder in your OneDrive. Share the folder link
                                  with colleagues so they can join.
                                </div>
                                <input value={wsCreateInput} onChange={e => setWsCreateInput(e.target.value)}
                                  placeholder="Workspace name (e.g. Smith & Co)"
                                  style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.bdr}`,
                                    fontSize:12,color:C.t1,background:C.card,marginBottom:8,boxSizing:'border-box'}} />
                                <div style={{display:'flex',gap:8}}>
                                  <button onClick={wsCreate} disabled={workspaceSyncing}
                                    style={{flex:1,padding:'8px',borderRadius:7,border:'none',
                                      background:'#0078D4',color:'#fff',fontSize:12,fontWeight:600,
                                      cursor:workspaceSyncing?'default':'pointer',opacity:workspaceSyncing?0.6:1}}>
                                    {workspaceSyncing ? 'Creating…' : 'Create'}
                                  </button>
                                  <button onClick={() => { setWsView('none'); setWorkspaceError(null); }}
                                    style={{padding:'8px 14px',borderRadius:7,border:`1px solid ${C.bdr}`,
                                      background:C.surf,color:C.t2,fontSize:12,cursor:'pointer'}}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {wsView === 'join' && (
                              <div>
                                <div style={{fontSize:11,color:C.t3,marginBottom:8,lineHeight:1.5}}>
                                  Paste the OneDrive share link your admin gave you.
                                  The link must be set to <strong>"Anyone with the link can edit"</strong>.
                                </div>
                                <input value={wsJoinInput} onChange={e => setWsJoinInput(e.target.value)}
                                  placeholder="https://onedrive.live.com/…"
                                  style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.bdr}`,
                                    fontSize:11,color:C.t1,background:C.card,marginBottom:8,boxSizing:'border-box'}} />
                                <div style={{display:'flex',gap:8}}>
                                  <button onClick={wsJoin} disabled={workspaceSyncing || !wsJoinInput.trim()}
                                    style={{flex:1,padding:'8px',borderRadius:7,border:'none',
                                      background:'#0078D4',color:'#fff',fontSize:12,fontWeight:600,
                                      cursor:(workspaceSyncing||!wsJoinInput.trim())?'default':'pointer',
                                      opacity:(workspaceSyncing||!wsJoinInput.trim())?0.5:1}}>
                                    {workspaceSyncing ? 'Joining…' : 'Join'}
                                  </button>
                                  <button onClick={() => { setWsView('none'); setWorkspaceError(null); }}
                                    style={{padding:'8px 14px',borderRadius:7,border:`1px solid ${C.bdr}`,
                                      background:C.surf,color:C.t2,fontSize:12,cursor:'pointer'}}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div style={{fontSize:12,color:C.t2,lineHeight:1.6,marginBottom:12}}>
                              Memory and statements are synced to the shared OneDrive folder.
                              Colleagues who have the same share link see the same payee rules and chart of accounts.
                            </div>

                            {workspaceError && (
                              <div style={{background:C.redDim,border:`1px solid ${C.redBrd}`,borderRadius:7,
                                padding:'8px 12px',fontSize:12,color:C.red,marginBottom:10}}>{workspaceError}</div>
                            )}

                            {workspaceShareUrl && (
                              <div style={{background:C.bluDim,border:`1px solid ${C.bluBrd}`,borderRadius:7,
                                padding:'8px 12px',marginBottom:10}}>
                                <div style={{fontSize:10,color:C.t3,fontWeight:600,marginBottom:4}}>SHARE THIS LINK WITH COLLEAGUES</div>
                                <div style={{fontSize:10,color:C.blu,wordBreak:'break-all',lineHeight:1.4}}>{workspaceShareUrl}</div>
                              </div>
                            )}

                            <div style={{display:'flex',gap:8}}>
                              <button onClick={wsPullMemory} disabled={workspaceSyncing}
                                style={{flex:1,padding:'8px',borderRadius:7,border:`1px solid ${C.bdr}`,
                                  background:C.surf,color:C.t1,fontSize:12,fontWeight:600,
                                  cursor:workspaceSyncing?'default':'pointer',opacity:workspaceSyncing?0.6:1}}>
                                {workspaceSyncing ? '↻ Syncing…' : '↻ Pull latest'}
                              </button>
                              <button onClick={wsLeave}
                                style={{padding:'8px 14px',borderRadius:7,border:`1px solid ${C.redBrd}`,
                                  background:C.redDim,color:C.red,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                                Leave
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <button onClick={disconnectCloud}
                    style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid ${C.redBrd}`,
                      background:C.redDim,color:C.red,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    Disconnect {CLOUD_CFG[cloudProvider].label}
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{padding:'14px 24px',borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
              <div style={{fontSize:11,color:C.t4,textAlign:'center',lineHeight:1.5}}>
                Your financial data never passes through our servers.<br/>
                Google Drive · OneDrive · Your storage, your control.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help / Guide panel */}
      {showHelp && (() => {
        const HELP = [
          { section:'Getting started', items:[
            { q:'How do I upload a statement?', a:'Go to the Upload tab. Set your Account Type (Current, Savings, Credit Card, etc.), Export To (QBO or Xero), and Tax Jurisdiction (UK VAT, Jersey GST, or Other). Then drag and drop one or more PDF bank statements onto the upload area. You can upload up to 50 files at once. Files are added to the Queue immediately.' },
            { q:'Which banks are supported?', a:'StatementAudit Pro works with any UK bank that produces PDF statements — Barclays, HSBC, Lloyds, NatWest, Santander, Starling, Monzo, Halifax, Bank of Scotland, Nationwide, and more. If a statement fails, try Re-run.' },
            { q:'What is Account Type for?', a:'Account Type tells the AI which rules to apply when reading the statement (e.g. credit cards use a different debit/credit convention). Choose the type that matches the account before processing.' },
            { q:'What is the Tax Jurisdiction selector?', a:'Set this on the Upload tab before processing. It controls which tax treatment options appear in the Code & Create coding screen. "UK VAT" shows UK VAT treatments (20%/5%/Zero/Exempt/Outside Scope). "Jersey GST" shows Jersey GST treatments (Standard 5%/Zero/Exempt/ISE/Outside Scope). "Other" hides the tax column entirely. The selection is remembered as your default for future sessions.' },
          ]},
          { section:'Processing (Queue)', items:[
            { q:'What does "Process All" do?', a:'It sends every queued file to the AI extraction engine one by one. Each PDF is read, transactions extracted, and automatically reconciled against the opening/closing balances printed on the statement.' },
            { q:'A file shows an error — what do I do?', a:'Click Re-run on that file. If it errors again, check that the PDF is a real bank statement (not a letter or certificate). Multi-page PDFs should be uploaded as a single merged file.' },
            { q:'Can I change Account Type after processing?', a:'Yes — select the new type from the dropdown in the Queue row, then click Re-run to re-extract with the corrected rules.' },
            { q:'How many statements can I process in one session?', a:'You can upload up to 50 PDF statements per batch. Add them to the queue by dragging and dropping multiple files at once, then click Process All.' },
          ]},
          { section:'Reviewing statements', items:[
            { q:'What does the confidence score mean?', a:'The score (0–100) reflects how cleanly the statement extracted and reconciled. Four tiers: ⚡ High (95+) — passes every check; Good (80–94) — reconciled with minor flags; Fair (70–79) — reconciled but has issues to review; Review (<70) — significant issues found. Hover the badge to see a one-line explanation of what to check. Fix the flagged issue and Re-run to improve the score.' },
            { q:'What is the ⚑ flag on a transaction?', a:'It means the AI was uncertain about that row — ambiguous description, split amounts, or a date that looked wrong. Review it manually. You can edit the amount, description, or category inline.' },
            { q:'How do I edit a transaction?', a:'Click directly on any cell in the transaction table while the statement is in Review status. Changes are saved automatically and the reconciliation recalculates.' },
            { q:'What does the 💱 FX badge mean?', a:'A 💱 badge on a transaction means the AI detected a foreign currency reference in the description (e.g. USD, EUR, AUD). The badge is informational only — the amount in the table is as printed on the statement in GBP. To look up the rate, open the coding screen for that transaction and click "Look up (free)" — it fetches a spot rate from frankfurter.app for that transaction date. The rate is reference only; it is never used in any arithmetic or written to an export.' },
            { q:'How do I attach a receipt to a transaction?', a:'Click the 📎 icon in the receipt column of any transaction row and select a PDF or image file. The receipt opens in a new tab when you click the icon again.' },
            { q:'What is Approve & Export?', a:'It downloads the transactions as a formatted CSV (QBO or Xero) and marks the statement as Approved. The statement moves to the Export tab. Use the keyboard shortcut A to approve the current statement.' },
            { q:'Can I re-open an approved statement?', a:'Yes — click the ↺ Roll back to Review button that appears on any Approved statement. This returns it to Review status so you can make changes. Rolling back does not delete any previously downloaded CSVs — those are already on your machine.' },
          ]},
          { section:'Exporting', items:[
            { q:'How do I import into QuickBooks Online?', a:'In QBO, go to Banking → Upload → drag the downloaded CSV file. Match the columns to QBO\'s format. StatementAudit Pro exports in QBO-native column order.' },
            { q:'How do I import into Xero?', a:'Standard import: Accounting → Bank Accounts → select account → Import Statement → upload the CSV. For Pathway 2 (Code & Create), import the _PRECODED.csv file the same way — it lands coded with the account code already applied and reconciles against the bank feed in one pass. Do not import a separate statement file alongside it.' },
            { q:'Can I merge multiple statements into one export?', a:'Yes — on the Export tab, use the "Merge & Export" button to combine all approved statements from the current project into a single QBO or Xero file.' },
          ]},
          { section:'Code & Create / Code & Reference', items:[
            { q:'What is Code & Create?', a:'Code & Create is Pathway 2 for Xero statements. It\'s designed for empty periods — months where no entries exist yet (catch-up or new-client onboarding). You confirm an account code for every transaction line before anything exports. The result is a single precoded CSV that, when imported into Xero, creates the transactions already coded and reconciles them against the bank feed in one pass.' },
            { q:'What is Code & Reference?', a:'Code & Reference is the QBO equivalent of Code & Create. QBO\'s bank CSV import does not apply codes automatically, so the exported CSV includes the confirmed codes in the Category and Nominal Code columns as a reference guide. Use it alongside QBO: import the CSV into the bank feed as normal, then use the reference codes on screen when manually categorising each transaction in QBO.' },
            { q:'What are the ✦ AI code suggestions?', a:'When you open the coding screen, the app automatically runs a background AI lookup for payees it has not seen before and proposes an account code — shown as a purple ✦ button next to the code field. Click ✦ to pre-fill the code field with the suggestion. You must still tick ✓ to confirm the line — suggestions are proposals only, never auto-applied. The ✦ button disappears once a line is confirmed.' },
            { q:'What is the VAT Treatment / GST Treatment column in the coding screen?', a:'If you set Tax Jurisdiction to "UK VAT" at upload, a VAT Treatment dropdown appears for each transaction line: Standard Rate (20%), Reduced Rate (5%), Zero Rated, Exempt, or Outside Scope. For "Jersey GST", it shows Jersey treatments: Standard Rate (5%), Zero Rated, Exempt, ISE Supply, or Outside Scope. These treatments are written into the Tax Rate column of the precoded Xero CSV on export — Xero reads them and applies the correct tax rate on import. For "Other" jurisdiction, the column is hidden.' },
            { q:'Can I edit payee names and descriptions in the coding screen?', a:'Yes — both the Payee and Description fields are editable inputs in the coding screen. Edit them before confirming the line. The edited payee and description are written into the exported CSV and will appear in Xero or QBO as entered.' },
            { q:'What is the empty-period assertion for?', a:'Xero\'s precoded import creates new coded transactions. If the period already has entries, importing again creates duplicates or match failures. The checkbox — "I confirm this period has no existing transactions in Xero" — is a hard gate: the Export button does not activate until it is ticked. Pathway 2 is for empty periods only.' },
            { q:'How do I load a chart of accounts for code suggestions?', a:'In the Code & Create modal, click Import CSV in the 📋 chart chip. Export your chart from Xero (Accounting → Chart of Accounts → Export) or QBO (Accounting → Chart of Accounts → export). The app reads Code and Name columns — once loaded, every account code input autocompletes with CODE — Name (Type) suggestions. The chart is stored in the browser and persists between sessions. Use Replace to swap to a different client\'s chart.' },
            { q:'What are Tracking Categories in the coding screen?', a:'If your client uses Xero Tracking (e.g. by department, property, or region), load their tracking options into the coding screen. Click "Import CSV" in the ⚙ tracking panel (Xero only) — export the file from Xero at Settings → General Settings → Tracking → Export. Once loaded, a compact tracking sub-row appears under each transaction line with optional selectors for up to two categories. Tracking is not required to confirm a line or export — it\'s additional metadata that goes into the Tracking1 and Tracking2 columns of the precoded CSV.' },
            { q:'How does Tracking appear in the exported precoded file?', a:'The precoded CSV (_PRECODED.csv) has Tracking1 and Tracking2 columns that Xero reads on import and assigns to the transactions automatically. Without a tracking CSV loaded, those columns export empty. Once categories are loaded and values selected in the coding screen, the exported file carries those values. Tracking choices are remembered per payee/description across sessions — next time you open a coding screen with the same payees they\'re pre-filled.' },
            { q:'Does confirming a code in the modal save it for future use?', a:'Yes — when you export from the coding screen, every confirmed code is saved back to the app\'s payee memory. Next time you process a statement with the same payees, those lines will show the "remembered" badge and can be auto-confirmed with the "Auto-confirm remembered payees" switch.' },
            { q:'What happens if I cancel the coding screen without exporting?', a:'Nothing is saved or exported. The statement remains in Review status unchanged. You can re-open the coding screen from the same statement any time.' },
          ]},
          { section:'Projects', items:[
            { q:'What are Projects?', a:'Projects let you organise statements by client or matter. Every statement belongs to a project (the default project is "Default"). The ◈ Projects tab shows a dashboard with approved/pending/error counts per project and the date of the last activity in each one. Use it to track where each client\'s statements stand at a glance.' },
            { q:'How do I create a new project?', a:'In the Projects dashboard (◈ tab), click the "+ New Project" card. Enter a name and press Enter. The new project appears immediately and you can assign statements to it from the Upload tab or by editing the project field on a statement in the queue.' },
            { q:'How do I assign a statement to a project?', a:'Set the project on the Upload tab before processing — it defaults to your last-used project. You can also change the project on any statement already in the queue. Statements are grouped by project in the sidebar.' },
            { q:'Can I rename or delete a project?', a:'Yes — in the Projects dashboard, click the pencil icon on any project card to rename it. Statements in that project update automatically. To remove a project, move all its statements to another project first, then delete the now-empty project.' },
          ]},
          { section:'Cloud Storage & Practice Workspace', items:[
            { q:'What do I need to do before the Connect buttons work?',
              a:'Both Google Drive and OneDrive require a one-time app registration so they know which app is requesting access to files. You\'ll create a free OAuth client ID in Google Cloud Console (for Drive) or Azure Portal (for OneDrive), then add it as a Render environment variable. The full numbered steps are in the ☁ Cloud panel — click the relevant "Setup" accordion. Total time: about 5 minutes per provider.' },
            { q:'How do I set up Google Drive — step by step?',
              a:'1. Go to console.cloud.google.com → New Project → name it StatementAudit Pro → Create. 2. APIs & Services → Library → enable the Google Drive API. 3. APIs & Services → OAuth consent screen → External → fill in App name + email → Save. 4. APIs & Services → Credentials → + Create Credentials → OAuth client ID → Web application. 5. Under Authorised redirect URIs add your exact Render URL (e.g. https://your-app.onrender.com — no trailing slash). 6. Create → copy the Client ID (ends in .apps.googleusercontent.com). 7. In Render: your service → Environment → add VITE_GOOGLE_CLIENT_ID = (paste ID) → Save. Render rebuilds in ~2 minutes and the Connect Google Drive button becomes active.' },
            { q:'How do I set up OneDrive — step by step?',
              a:'1. Go to portal.azure.com → search "App registrations" → + New registration. 2. Name: StatementAudit Pro. Account types: "Accounts in any organizational directory and personal Microsoft accounts". 3. Redirect URI: Web → your exact Render URL (e.g. https://your-app.onrender.com). 4. Register → copy the Application (client) ID from the Overview page (it\'s a GUID). 5. API permissions → + Add a permission → Microsoft Graph → Delegated → tick Files.ReadWrite and User.Read → Add permissions (important: choose Files.ReadWrite, not Files.ReadWrite.AppFolder — the workspace feature requires this). 6. Click "Grant admin consent" if shown (needed for organisation accounts, not personal). 7. In Render: your service → Environment → add VITE_MICROSOFT_CLIENT_ID = (paste GUID) → Save. Rebuild completes in ~2 minutes.' },
            { q:'Where do I find my Render app URL to use as the redirect URI?',
              a:'In your Render dashboard, open the service → the URL shown at the top (e.g. https://statementaudit-pro.onrender.com) is what you paste as the redirect URI in both Google Cloud and Azure. Use the exact URL — no trailing slash, and make sure it starts with https://. If you later add a custom domain, you\'ll need to add that URL as an additional redirect URI in both consoles.' },
            { q:'Do I need to set up both providers, or can I choose just one?',
              a:'You only need to set up the one you want to use — there\'s no requirement to configure both. OneDrive is the better choice for UK accounting practices already using Microsoft 365 — it unlocks the Practice Workspace feature (shared payee rules and chart of accounts across the team). Google Drive works well if your team uses Google Workspace. Both work identically for personal cloud save.' },
            { q:'What is the Practice Workspace and how does it work?',
              a:'The Practice Workspace is a shared OneDrive folder that your whole team accesses through StatementAudit Pro. Once connected to OneDrive: the admin clicks "Create workspace" in the Cloud panel, gives it a name, and the app creates a folder in their OneDrive. They then share that folder link from OneDrive (right-click → Share → Anyone with the link can edit → Copy link) and give it to colleagues. Each colleague opens Cloud panel → "Join workspace" → pastes the link. From that point, payee memory, chart of accounts, and tracking categories are shared automatically — when anyone processes a statement and exports, the memory updates for everyone in the workspace.' },
            { q:'What gets shared in the Practice Workspace?',
              a:'The workspace shares: payee code memory (the codes you\'ve confirmed for each payee), category memory, Jersey GST treatment memory, Xero tracking category selections, chart of accounts (if loaded), and tracking categories (if loaded). Individual statements are also saved to the workspace folder so colleagues can see all approved statements. The workspace does NOT share login credentials — each user connects to Microsoft with their own account.' },
            { q:'Can I use the workspace if I\'m on Google Drive?',
              a:'No — the Practice Workspace feature uses Microsoft OneDrive\'s sharing model. It is only available when connected to Microsoft / OneDrive. Google Drive users get personal cloud save (statements auto-saved to a private app folder) but not the shared workspace.' },
            { q:'What happens if I disconnect from Microsoft?',
              a:'Disconnecting from Microsoft also leaves the workspace — your local payee memory and other settings are kept in the browser, but the connection to the shared folder is cleared. To reconnect, sign back in to Microsoft and join the workspace again using the same share link.' },
          ]},
          { section:'Guide Mode & Navigation', items:[
            { q:'What is Guide Mode?',
              a:'Guide Mode adds a hover tooltip to every button and tab in the app — hover any element to see a short explanation of what it does and how it fits into the workflow. Turn it on by clicking the 💡 Guide button in the top-right of the screen. It turns green when active. Your preference is saved — Guide Mode stays on or off between sessions.' },
            { q:'How do I turn Guide Mode on and off?',
              a:'Click the 💡 Guide button at the top right of the screen. When Guide Mode is on the button turns green and shows "Guide on". Click again to turn it off. The setting persists between sessions — you don\'t need to re-enable it each time you open the app.' },
            { q:'Which elements show tooltips?',
              a:'Guide Mode covers: the four main navigation tabs (Upload, Process, Review, Export), all topbar action buttons (Cloud, Help, Feedback, Shortcuts), and the key action buttons in each tab — including Approve, Reject, Code & Create, Code & Reference, Audit Workbook, Reset edits, Roll back, Process All, Re-run, Save Rules, Import Rules, Merge exports, and all per-statement Download buttons.' },
            { q:'What are the keyboard shortcuts?',
              a:'In the Review tab: A = Approve & Export the current statement. R = Reject the current statement. ← → = navigate between statements. ? = show/hide the shortcuts panel. Shortcuts only fire when focus is not inside a text input.' },
          ]},
          { section:'Audit Workbook', items:[
            { q:'What is the Audit Workbook and what does it contain?',
              a:'The Audit Workbook is a three-sheet Excel file you download from the Export tab (↓ Audit Workbook button). Sheet 1 "Audit Review" is the full transaction register — every row the AI extracted, with dates, payees, debits, credits, running balance, expected balance, category, nominal code, GST Treatment (Xero Pathway 2 only), notes, flags, and a Receipt filename column. Sheet 2 "QBO/Xero Import (clean)" is the stripped CSV-format data ready for accounting software. Sheet 3 "Receipts" lists every transaction that has a receipt attached.' },
            { q:'Does the Audit Workbook include Jersey GST treatment?',
              a:'Yes — Sheet 1 "Audit Review" has a GST Treatment column (column 12, after Nominal code). For Xero statements processed through Pathway 2 (Code & Create), it shows the confirmed treatment for each transaction: Standard Rate (5%), Zero Rated (0%), Exempt, ISE Supply (>£1,000), or Outside Scope / No GST. For non-Xero statements the column is present but empty. The treatment is pulled from the app\'s treatment memory at the time you download the workbook — if you haven\'t run Pathway 2 yet it will be blank.' },
            { q:'How do I use the Audit Workbook for client or partner sign-off?',
              a:'Open it in Excel or Google Sheets, filter or sort the Audit Review sheet to the period in question, and highlight any rows you want the client to confirm. You can add a Notes column, use Excel\'s Track Changes (Review → Track Changes), or share a Google Sheets link with Comment access so the client can query individual lines without editing the data. The workbook is self-contained — no software licence required for the reviewer.' },
            { q:'How do I use Excel Copilot to review the workbook for errors?',
              a:'Open the workbook in Excel (Microsoft 365 required). Click the Copilot button in the Home ribbon. Useful prompts to try: "Are there any rows where both Debit and Credit are populated — that may indicate an extraction error?" · "Highlight any transactions over £10,000 and list the payees." · "Are there any duplicate amounts on the same date with the same payee?" · "Summarise total spend by category and flag any category with unusually high spend." · "Does the running balance column stay consistent, or are there any sudden jumps?" Copilot reads the selected sheet and answers in plain English, flagging anomalies it spots.' },
            { q:'How do I use Google Sheets Gemini to review the workbook?',
              a:'Upload the .xlsx file to Google Drive and open it in Google Sheets. Click Help → Ask Gemini (or the Gemini icon in the side panel). Useful prompts to try: "Are there any unusual transactions in this sheet — large round numbers, duplicate payees on the same date, or missing descriptions?" · "What are the five largest payments out and do any look out of pattern?" · "Flag any rows where the Debit column is blank and the Credit column is also blank." · "Summarise monthly totals for Debits and Credits and tell me if any month looks significantly different." Gemini highlights suspect rows and can insert comments directly onto cells.' },
            { q:'Can I add my own notes or adjustments to the workbook?',
              a:'Yes — the Audit Review sheet is a plain Excel file. Add columns, notes, colour-coding, or formulas as needed. A common practice is to add a "Reviewed by" column and a "Confirmed ✓" tick column, then have the client initial the workbook before it goes to the accountant. Keep the QBO/Xero Import sheet untouched so you can still copy-paste it into your accounting software without reformatting.' },
          ]},
          { section:'Troubleshooting', items:[
            { q:'Reconciliation fails — variance shows a small amount', a:'Check for a transaction the AI missed (common with faint print or rotated text). Edit the opening or closing balance if the statement PDF shows a different figure. Re-run after any change.' },
            { q:'Wrong transactions or amounts extracted', a:'Edit cells directly in the Review table. If the problem is systematic (wrong account type), change the type in the Queue and Re-run.' },
            { q:'Confidence score stays low after fixing issues', a:'After editing, click Re-run to re-extract and recalculate. Edits alone don\'t trigger a rescore — a full re-run does.' },
          ]},
        ];
        const q = helpQuery.toLowerCase().trim();
        const filtered = HELP.map(s => ({
          ...s,
          items: s.items.filter(i => !q || i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)),
        })).filter(s => s.items.length > 0);
        return (
          <div onClick={() => setShowHelp(false)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:900,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}}>
            <div onClick={e => e.stopPropagation()}
              style={{width:440,maxWidth:'95vw',height:'100vh',background:C.card,borderLeft:`1px solid ${C.bdr}`,
                display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,0.2)'}}>
              {/* Header */}
              <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0,background:C.blu}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:'#fff'}}>StatementAudit Help</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:2}}>Guides &amp; FAQs</div>
                  </div>
                  <button onClick={() => setShowHelp(false)}
                    style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:20,cursor:'pointer',
                      width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
                <input value={helpQuery} onChange={e => setHelpQuery(e.target.value)}
                  placeholder="Search questions, keywords or topics…"
                  style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',
                    borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none',
                    '::placeholder':{color:'rgba(255,255,255,0.5)'}}}/>
              </div>
              {/* Content */}
              <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
                {filtered.length === 0
                  ? <div style={{fontSize:13,color:C.t3,textAlign:'center',marginTop:40}}>No results for "{helpQuery}"</div>
                  : filtered.map(sec => (
                    <div key={sec.section} style={{marginBottom:20}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>{sec.section}</div>
                      {sec.items.map(item => (
                        <details key={item.q} style={{marginBottom:6}}>
                          <summary style={{fontSize:13,fontWeight:600,color:C.t1,cursor:'pointer',padding:'9px 12px',
                            background:C.surf,borderRadius:8,border:`1px solid ${C.bdr}`,listStyle:'none',
                            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            {item.q}
                            <span style={{fontSize:11,color:C.t4,flexShrink:0,marginLeft:8}}>▾</span>
                          </summary>
                          <div style={{fontSize:13,color:C.t2,lineHeight:1.6,padding:'10px 12px',
                            background:C.card,borderRadius:'0 0 8px 8px',border:`1px solid ${C.bdr}`,borderTop:'none'}}>
                            {item.a}
                          </div>
                        </details>
                      ))}
                    </div>
                  ))
                }
              </div>
              {/* Footer */}
              <div style={{padding:'14px 24px',borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
                <div style={{fontSize:12,color:C.t3,textAlign:'center'}}>
                  Need more help? Email <a href="mailto:support@statementaudit.pro" style={{color:C.blu}}>support@statementaudit.pro</a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Give feedback popover */}
      {showFeedback && (
        <div onClick={() => setShowFeedback(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:900,
            display:'flex',alignItems:'flex-start',justifyContent:'flex-end',paddingTop:64,paddingRight:24}}>
          <div onClick={e => e.stopPropagation()}
            style={{width:380,background:'#fff',borderRadius:16,boxShadow:'0 16px 48px rgba(0,0,0,0.22)',
              border:`1px solid ${C.bdr}`,overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'20px 20px 14px',borderBottom:`1px solid ${C.bdr}`,
              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:15,fontWeight:700,color:C.t1,flex:1,paddingRight:8}}>
                {feedbackSent ? 'Thanks for your feedback!' : 'Share your thoughts about StatementAudit Pro'}
              </div>
              <button onClick={() => setShowFeedback(false)}
                style={{background:'none',border:'none',fontSize:18,color:C.t3,cursor:'pointer',
                  lineHeight:1,padding:'0 0 0 4px',flexShrink:0}}>×</button>
            </div>
            {feedbackSent ? (
              <div style={{padding:'32px 20px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:12}}>✓</div>
                <div style={{fontSize:14,color:C.t2,lineHeight:1.6,marginBottom:20}}>
                  We've received your message — thank you!<br/>
                  Your feedback helps shape what we build next.
                </div>
                <button onClick={() => { setShowFeedback(false); setFeedbackText(''); setFeedbackEmail(''); setFeedbackSent(false); }}
                  style={{padding:'10px 24px',background:C.blu,color:'#fff',border:'none',borderRadius:8,
                    fontSize:14,fontWeight:600,cursor:'pointer'}}>
                  Close
                </button>
              </div>
            ) : (
              <div style={{padding:'16px 20px 20px'}}>
                {/* Textarea */}
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Reactions and suggestions welcome! Thanks!"
                  rows={6}
                  style={{width:'100%',boxSizing:'border-box',resize:'vertical',padding:'12px',
                    fontSize:13,color:C.t1,border:`1px solid ${C.bdr}`,borderRadius:9,
                    outline:'none',fontFamily:'Inter,sans-serif',lineHeight:1.6,
                    background:C.surf,transition:'border-color 0.15s'}}
                  onFocus={e => e.target.style.borderColor=C.bluBrd}
                  onBlur={e => e.target.style.borderColor=C.bdr}
                />
                {/* Optional email */}
                <input
                  value={feedbackEmail}
                  onChange={e => setFeedbackEmail(e.target.value)}
                  placeholder="Your email (optional — so we can follow up)"
                  type="email"
                  style={{width:'100%',boxSizing:'border-box',marginTop:8,padding:'9px 12px',
                    fontSize:12,color:C.t1,border:`1px solid ${C.bdr}`,borderRadius:8,
                    outline:'none',fontFamily:'Inter,sans-serif',background:C.surf,
                    transition:'border-color 0.15s'}}
                  onFocus={e => e.target.style.borderColor=C.bluBrd}
                  onBlur={e => e.target.style.borderColor=C.bdr}
                />
                {/* Footer row */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:14}}>
                  <div style={{fontSize:11,color:C.t4,lineHeight:1.4,maxWidth:200}}>
                    Sent directly to the product team.
                  </div>
                  <button onClick={submitFeedback}
                    disabled={!feedbackText.trim() || feedbackSending}
                    style={{padding:'10px 22px',background:feedbackText.trim()?C.blu:'#C8D0DC',
                      color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,
                      cursor:feedbackText.trim()?'pointer':'default',transition:'background 0.15s',
                      flexShrink:0}}>
                    {feedbackSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trial access code gate — full-screen, highest z-index */}
      {showTrialGate && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,27,45,0.94)',zIndex:9999,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:C.card,borderRadius:18,padding:'40px 44px',width:400,maxWidth:'100%',
            boxShadow:'0 32px 80px rgba(0,0,0,0.5)',border:`1px solid ${C.bdr}`,textAlign:'center'}}>
            <div style={{width:52,height:52,borderRadius:14,background:C.blu,display:'flex',alignItems:'center',
              justifyContent:'center',color:'#fff',fontWeight:700,fontSize:24,margin:'0 auto 20px'}}>£</div>
            <div style={{fontSize:22,fontWeight:700,color:C.t1,marginBottom:6}}>StatementAudit Pro</div>
            <div style={{fontSize:13,color:C.t3,marginBottom:28,lineHeight:1.5}}>
              This is a private demo — enter your access code to continue.
            </div>
            <input
              value={trialCodeInput}
              onChange={e => { setTrialCodeInput(e.target.value.toUpperCase()); setTrialCodeError(false); }}
              onKeyDown={e => e.key === 'Enter' && checkTrialCode()}
              placeholder="ENTER CODE"
              autoFocus
              style={{width:'100%',boxSizing:'border-box',padding:'13px 16px',fontSize:17,
                fontWeight:700,letterSpacing:'0.12em',textAlign:'center',
                border:`2px solid ${trialCodeError ? C.red : C.bdr}`,borderRadius:10,outline:'none',
                color:C.t1,fontFamily:'JetBrains Mono,monospace',marginBottom:trialCodeError?6:14,
                background:C.surf,transition:'border-color 0.15s'}}
            />
            {trialCodeError && (
              <div style={{fontSize:12,color:C.red,marginBottom:12}}>
                Incorrect code — check with your contact.
              </div>
            )}
            <button onClick={checkTrialCode}
              style={{width:'100%',padding:'13px',background:C.blu,color:'#fff',border:'none',
                borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',marginBottom:20,
                transition:'opacity 0.15s'}}
              onMouseEnter={e => e.currentTarget.style.opacity='0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}>
              Continue →
            </button>
            <div style={{fontSize:12,color:C.t4}}>
              No code?{' '}
              <a href="mailto:csmm1964@gmail.com?subject=StatementAudit Pro — Demo Access Request"
                style={{color:C.blu,textDecoration:'none',fontWeight:500}}>
                Request demo access →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Pathway 2 — coding confirmation modal */}
      {showCodingModal && (() => {
        const stmt = stmts.find(s => s.id === codingStmtId);
        if (!stmt) return null;
        const total        = codingLines.length;
        const confirmed    = codingLines.filter(l => l.confirmed).length;
        const isXero       = stmt.platform === 'xero';
        const jur          = stmt.jurisdiction || 'uk';
        const hasTaxCol    = isXero && jur !== 'other';
        const activePack   = jur === 'jersey' ? gstJersey : jur === 'uk' ? vatUK : null;
        const taxLabel     = jur === 'jersey' ? 'GST Treatment' : 'VAT Treatment';
        const gstComplete  = !hasTaxCol || codingLines.every(l => l.gstTreatment !== '');
        const rulePackOk   = !hasTaxCol || !activePack?.isExpired();
        const canExport    = confirmed === total && (!isXero || emptyPeriodOk) && total > 0 && gstComplete && rulePackOk;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',zIndex:9994,
            display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}}>
            <div style={{background:C.card,borderRadius:16,width:'100%',maxWidth:800,
              boxShadow:'0 24px 64px rgba(0,0,0,0.5)',border:`1px solid ${C.bdr}`,
              marginTop:20,marginBottom:20}}>

              {/* Header */}
              <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.bdr}`,
                display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.t1,marginBottom:2}}>
                    ✎ {isXero ? 'Code & Create' : 'Code & Reference'} — {stmt.bankName||'Statement'}
                  </div>
                  <div style={{fontSize:12,color:C.t3}}>
                    {isXero
                      ? 'Pathway 2 · Confirm a code for every line · Export one precoded Xero import'
                      : 'Reference coding · Confirm a code for every line · Export QBO CSV with reference codes'}
                  </div>
                </div>
                <button onClick={() => setShowCodingModal(false)}
                  style={{fontSize:12,color:C.t3,background:'none',border:`1px solid ${C.bdr}`,
                    borderRadius:6,padding:'4px 12px',cursor:'pointer',marginLeft:16,flexShrink:0}}>
                  ✕ Cancel
                </button>
              </div>

              {/* Controls */}
              <div style={{padding:'12px 24px',borderBottom:`1px solid ${C.bdr}`,
                display:'flex',gap:12,alignItems:'stretch',flexWrap:'wrap'}}>
                {isXero ? (
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',flex:'1 1 300px',
                    background:emptyPeriodOk ? C.grnDim : C.redDim,
                    border:`1px solid ${emptyPeriodOk ? C.grnBrd : C.redBrd}`,
                    borderRadius:8,padding:'10px 14px'}}>
                    <input type="checkbox" checked={emptyPeriodOk}
                      onChange={e => setEmptyPeriodOk(e.target.checked)}
                      style={{accentColor:C.grn,width:14,height:14,flexShrink:0}}/>
                    <span style={{fontSize:12,color:emptyPeriodOk ? C.grn : C.red,fontWeight:500,lineHeight:1.4}}>
                      I confirm this period has no existing transactions in Xero
                      <span style={{display:'block',fontSize:11,fontWeight:400,marginTop:1,opacity:0.8}}>
                        Pathway 2 is for empty periods only — avoid duplicate entries
                      </span>
                    </span>
                  </label>
                ) : (
                  <div style={{display:'flex',alignItems:'flex-start',gap:8,flex:'1 1 300px',
                    background:C.bluDim,border:`1px solid ${C.bluBrd}`,
                    borderRadius:8,padding:'10px 14px'}}>
                    <span style={{fontSize:18,lineHeight:1,flexShrink:0}}>ℹ</span>
                    <span style={{fontSize:12,color:C.blu,lineHeight:1.5}}>
                      <strong>Reference coding for QBO</strong>
                      <span style={{display:'block',fontWeight:400,marginTop:2}}>
                        Confirm a code for each line. The exported CSV includes the codes in the Category &amp; Nominal Code columns as a reference guide — use them when manually coding in QBO. QBO does not apply codes automatically on bank CSV import.
                      </span>
                    </span>
                  </div>
                )}
                {hasTaxCol && activePack && (
                  <div style={{display:'flex',alignItems:'center',gap:8,flex:'0 1 auto',
                    background: rulePackOk ? C.grnDim : C.redDim,
                    border:`1px solid ${rulePackOk ? C.grnBrd : C.redBrd}`,
                    borderRadius:8,padding:'10px 14px'}}>
                    <span style={{fontSize:18,lineHeight:1,flexShrink:0}}>{rulePackOk ? '🏛' : '⚠️'}</span>
                    <span style={{fontSize:11,color: rulePackOk ? C.grn : C.red,lineHeight:1.4}}>
                      <strong>{jur === 'jersey' ? `Jersey GST Rule-Pack v${gstJersey.version}` : `UK VAT Rule-Pack v${vatUK.version}`}</strong>
                      <span style={{display:'block',fontWeight:400,marginTop:1}}>
                        {rulePackOk
                          ? `Effective ${activePack.effectiveDate} · Verified ${activePack.verifiedAt} · Source: ${jur === 'jersey' ? 'Revenue Jersey' : 'HMRC'}`
                          : `Rule-pack expired — precoded export blocked. Update ${jur === 'jersey' ? 'gstJersey' : 'vatUK'}.verifiedAt before continuing.`}
                      </span>
                    </span>
                  </div>
                )}
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',
                  background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'10px 14px'}}>
                  <input type="checkbox" checked={autoConfirmMem}
                    onChange={e => {
                      const on = e.target.checked;
                      setAutoConfirmMem(on);
                      setCodingLines(prev => prev.map(l => l.fromMemory ? {...l, confirmed: on} : l));
                    }}
                    style={{accentColor:C.blu,width:14,height:14,flexShrink:0}}/>
                  <span style={{fontSize:12,color:C.t2,lineHeight:1.4}}>
                    Auto-confirm remembered payees
                    <span style={{display:'block',fontSize:11,color:C.t4,marginTop:1}}>
                      Confirms lines where a code is already remembered
                    </span>
                  </span>
                </label>
                <div style={{display:'flex',alignItems:'center',gap:8,
                  background:C.surf,border:`1px solid ${chartAccounts.length?C.bluBrd:C.bdr}`,
                  borderRadius:8,padding:'10px 14px',flexShrink:0}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:chartAccounts.length?C.blu:C.t3,fontWeight:500}}>
                      {chartAccounts.length ? `📋 ${chartAccounts.length} accounts` : '📋 No chart loaded'}
                    </div>
                    <div style={{fontSize:11,color:C.t4,marginTop:1}}>
                      {chartAccounts.length ? 'Code inputs show autocomplete' : 'Import for code suggestions'}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    <button onClick={() => chartInputRef.current?.click()}
                      style={{...btn('outline'),padding:'3px 9px',fontSize:11}}>
                      {chartAccounts.length ? 'Replace CSV' : 'Import CSV'}
                    </button>
                    {XERO_CLIENT_ID && (
                      <button onClick={startXeroCoaAuth}
                        title="Connect your Xero Chart of Accounts"
                        style={{...btn('outline'),padding:'3px 9px',fontSize:11,color:'#13B5EA',borderColor:'#13B5EA'}}>
                        Connect Xero
                      </button>
                    )}
                    {QBO_CLIENT_ID && (
                      <button onClick={startQboCoaAuth}
                        title="Connect your QuickBooks Chart of Accounts"
                        style={{...btn('outline'),padding:'3px 9px',fontSize:11,color:'#2CA01C',borderColor:'#2CA01C'}}>
                        Connect QBO
                      </button>
                    )}
                    {chartAccounts.length > 0 && (
                      <button onClick={() => setChartAccounts([])}
                        title="Clear chart"
                        style={{...btn('outline'),padding:'3px 7px',fontSize:11,
                          color:C.red,borderColor:C.redBrd}}>✕</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tracking categories panel — Xero only */}
              {isXero && (
                <div style={{padding:'8px 24px',borderBottom:`1px solid ${C.bdr}`,
                  display:'flex',alignItems:'center',gap:8,
                  background: trackingCategories.cats.length ? C.bluDim : C.bg}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:trackingCategories.cats.length?C.blu:C.t3,fontWeight:500}}>
                      {trackingCategories.cats.length
                        ? `⚙ ${trackingCategories.cats.map(c=>c.name).join(' & ')} · ${trackingCategories.cats.reduce((n,c)=>n+c.options.length,0)} options · source: ${trackingCategories.source}`
                        : '⚙ No tracking categories loaded'}
                    </div>
                    <div style={{fontSize:11,color:C.t4,marginTop:1}}>
                      {trackingCategories.cats.length
                        ? 'Tracking selectors shown per line (optional — not a gate)'
                        : 'Import Xero tracking CSV to show selectors per line · Xero: Settings → Tracking → Export'}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    <button onClick={() => trackingInputRef.current?.click()}
                      style={{...btn('outline'),padding:'3px 9px',fontSize:11}}>
                      {trackingCategories.cats.length ? 'Replace' : 'Import CSV'}
                    </button>
                    {trackingCategories.cats.length > 0 && (
                      <button onClick={() => setTrackingCategories({source:'none',cats:[]})}
                        title="Clear tracking categories"
                        style={{...btn('outline'),padding:'3px 7px',fontSize:11,color:C.red,borderColor:C.redBrd}}>✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* hidden chart file input */}
              <input ref={chartInputRef} type="file" accept=".csv" onChange={importChartCSV} style={{display:'none'}}/>
              <input ref={trackingInputRef} type="file" accept=".csv" onChange={importTrackingCSV} style={{display:'none'}}/>
              {/* datalist for account code autocomplete */}
              <datalist id="sa-chart-datalist">
                {chartAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}{a.type ? ` (${a.type})` : ''}</option>
                ))}
              </datalist>

              {/* Transaction table */}
              <div style={{maxHeight:'52vh',overflowY:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'86px 1fr 90px 140px 130px 44px',
                  padding:'7px 24px',background:C.bg,borderBottom:`1px solid ${C.bdr}`,
                  position:'sticky',top:0,zIndex:1}}>
                  {['Date','Payee / Description','Amount','Account Code', hasTaxCol ? taxLabel : '',''].map((h,i) => (
                    <div key={i} style={{fontSize:10,color:C.t4,fontWeight:700,
                      textTransform:'uppercase',letterSpacing:'0.06em',
                      textAlign:i===2?'right':i===5?'center':'left'}}>{h}</div>
                  ))}
                </div>
                {codingLines.map((l, i) => {
                  const amt   = l.credit != null && l.debit == null ? `+${fmtCcy(l.credit)}`
                              : l.debit  != null ? `-${fmtCcy(l.debit)}` : '—';
                  const isPos = l.credit != null && l.debit == null;
                  return (
                    <div key={l.id||i}
                      style={{background: l.confirmed ? C.grnDim : i%2===0 ? C.card : C.surf,
                        borderBottom:`1px solid ${C.bdr}`,transition:'background 0.1s'}}>
                      <div style={{display:'grid',gridTemplateColumns:'86px 1fr 90px 140px 130px 44px',
                        padding:'6px 24px',alignItems:'start'}}>
                      <div style={{fontSize:11,color:C.t3,fontFamily:'JetBrains Mono,monospace'}}>{l.date}</div>
                      <div style={{paddingRight:8,display:'flex',flexDirection:'column',gap:3,overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:4,minWidth:0}}>
                          <input value={l.payee||''}
                            onChange={e => updateCodingLine(l.id||i, {payee: e.target.value})}
                            placeholder="Payee"
                            style={{flex:1,minWidth:0,padding:'3px 6px',background:C.bg,
                              border:`1px solid ${C.bdrBrt}`,borderRadius:5,color:C.t1,fontSize:12,
                              fontFamily:'Inter,sans-serif',outline:'none',boxSizing:'border-box'}}/>
                          {l.fromMemory && (
                            <span style={{flexShrink:0,fontSize:10,color:C.blu,background:C.bluDim,
                              border:`1px solid ${C.bluBrd}`,borderRadius:3,padding:'1px 5px'}}>
                              remembered
                            </span>
                          )}
                        </div>
                        <input value={l.description||''}
                          onChange={e => updateCodingLine(l.id||i, {description: e.target.value})}
                          placeholder="Description (optional)"
                          style={{width:'100%',padding:'3px 6px',background:C.bg,
                            border:`1px solid ${C.bdrBrt}`,borderRadius:5,color:C.t3,fontSize:11,
                            fontFamily:'Inter,sans-serif',outline:'none',boxSizing:'border-box'}}/>
                      </div>
                      <div style={{fontSize:12,fontFamily:'JetBrains Mono,monospace',
                        textAlign:'right',color:isPos ? C.grn : C.red}}>{amt}</div>
                      <div style={{paddingLeft:8}}>
                        <input value={l.code} list="sa-chart-datalist"
                          onChange={e => updateCodingLine(l.id||i, {code: e.target.value, confirmed: false})}
                          placeholder="e.g. 400"
                          style={{width:'100%',padding:'4px 8px',background:C.bg,
                            border:`1px solid ${l.confirmed ? C.grnBrd : C.bdrBrt}`,
                            borderRadius:6,color:C.t1,fontSize:12,
                            fontFamily:'JetBrains Mono,monospace',outline:'none',boxSizing:'border-box'}}/>
                        {(() => {
                          const key = normKey(l.payee, l.description);
                          const sug = !l.fromMemory && key && codingSuggestions[key];
                          return sug ? (
                            <button onClick={() => updateCodingLine(l.id||i, {code: sug.code, confirmed: false})}
                              title="Click to apply AI suggestion"
                              style={{marginTop:3,width:'100%',padding:'2px 6px',background:C.purDim,
                                border:`1px solid ${C.purBrd}`,borderRadius:4,color:C.pur,fontSize:10,
                                cursor:'pointer',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',
                                whiteSpace:'nowrap',fontFamily:'Inter,sans-serif'}}>
                              ✦ {sug.code}{sug.name ? ` — ${sug.name}` : ''}
                            </button>
                          ) : null;
                        })()}
                      </div>
                      {hasTaxCol && activePack ? (
                        <div style={{paddingLeft:6}}>
                          <select value={l.gstTreatment||''}
                            onChange={e => updateCodingLine(l.id||i, {gstTreatment: e.target.value, confirmed: false})}
                            style={{width:'100%',padding:'4px 6px',background:C.bg,
                              border:`1px solid ${l.gstTreatment ? (l.confirmed ? C.grnBrd : C.ambBrd) : C.redBrd}`,
                              borderRadius:6,color: l.gstTreatment ? C.t1 : C.red,fontSize:11,
                              outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                            <option value=''>— pick treatment —</option>
                            {activePack.options.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div/>
                      )}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <button
                          onClick={() => updateCodingLine(l.id||i, {confirmed: !l.confirmed})}
                          disabled={!l.code.trim() || (hasTaxCol && !l.gstTreatment)}
                          title={l.confirmed ? 'Un-confirm' : 'Confirm this code'}
                          style={{width:28,height:28,borderRadius:6,flexShrink:0,
                            border:`1px solid ${l.confirmed ? C.grnBrd : C.bdrBrt}`,
                            background: l.confirmed ? C.grn : 'none',
                            color: l.confirmed ? '#fff' : C.t4,
                            cursor: l.code.trim() ? 'pointer' : 'default',
                            fontSize:14,fontWeight:700,
                            display:'flex',alignItems:'center',justifyContent:'center'}}>
                          ✓
                        </button>
                      </div>
                      </div>
                      {isXero && trackingCategories.cats.length > 0 && (
                        <div style={{padding:'0 24px 5px',paddingLeft:118,display:'flex',
                          gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{fontSize:10,color:C.t4,flexShrink:0,marginRight:2}}>Tracking:</span>
                          {trackingCategories.cats.slice(0,2).map((cat, ci) => (
                            <select key={ci}
                              value={ci===0 ? l.tracking1||'' : l.tracking2||''}
                              onChange={e => updateCodingLine(l.id||i,
                                ci===0 ? {tracking1:e.target.value,confirmed:false}
                                       : {tracking2:e.target.value,confirmed:false})}
                              style={{flex:1,maxWidth:200,padding:'3px 6px',background:C.bg,
                                border:`1px solid ${C.bdrBrt}`,borderRadius:5,color:C.t2,
                                fontSize:11,outline:'none',cursor:'pointer'}}>
                              <option value=''>— {cat.name} (optional) —</option>
                              {cat.options.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const fx = detectFX(l.description);
                        if (!fx) return null;
                        return (
                          <div style={{padding:'0 24px 5px',paddingLeft:118,display:'flex',
                            gap:8,alignItems:'center',flexWrap:'wrap'}}>
                            <span style={{fontSize:10,color:'#7C4DFF',flexShrink:0,fontWeight:600}}>💱 {fx.currency}/GBP rate:</span>
                            <input value={l.fxRate||''}
                              onChange={e => updateCodingLine(l.id||i, {fxRate: e.target.value})}
                              placeholder="e.g. 1.2650"
                              style={{width:90,padding:'2px 6px',background:C.bg,border:'1px solid #C9B8FF',
                                borderRadius:5,color:C.t1,fontSize:11,fontFamily:'JetBrains Mono,monospace',outline:'none'}}/>
                            <button
                              onClick={async () => {
                                const isoDate = txDateToISO(l.date);
                                if (!isoDate) return;
                                updateCodingLine(l.id||i, {fxRate: '…'});
                                try {
                                  const r = await fetch(`https://api.frankfurter.app/${isoDate}?from=${fx.currency}&to=GBP`);
                                  const d = await r.json();
                                  const rate = d?.rates?.GBP;
                                  if (rate) updateCodingLine(l.id||i, {fxRate: String(rate)});
                                  else updateCodingLine(l.id||i, {fxRate: ''});
                                } catch { updateCodingLine(l.id||i, {fxRate: ''}); }
                              }}
                              style={{padding:'2px 9px',background:'#EDE7FF',border:'1px solid #C9B8FF',
                                borderRadius:5,color:'#7C4DFF',fontSize:10,cursor:'pointer',fontWeight:600}}>
                              Look up (free)
                            </button>
                            {l.fxRate && l.fxRate !== '…' && <span style={{fontSize:10,color:C.t3}}>· reference only</span>}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{padding:'14px 24px',borderTop:`1px solid ${C.bdr}`,
                display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{fontSize:13,color: confirmed === total && total > 0 ? C.grn : C.t3}}>
                  {confirmed} / {total} lines confirmed
                  {isXero && !emptyPeriodOk && total > 0 && (
                    <span style={{marginLeft:10,fontSize:11,color:C.red}}>· tick the empty-period box above</span>
                  )}
                  {isXero && !gstComplete && (
                    <span style={{marginLeft:10,fontSize:11,color:C.red}}>· pick {taxLabel.toLowerCase()} for every line</span>
                  )}
                  {isXero && !rulePackOk && (
                    <span style={{marginLeft:10,fontSize:11,color:C.red,fontWeight:600}}>· {jur === 'jersey' ? 'GST' : 'VAT'} rule-pack expired — export blocked</span>
                  )}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => setShowCodingModal(false)}
                    style={{...btn('outline'),padding:'8px 16px',fontSize:13}}>Cancel</button>
                  <button onClick={exportP2} disabled={!canExport}
                    title={canExport
                      ? (isXero ? 'Export precoded Xero CSV and approve statement' : 'Export QBO CSV with reference codes and approve statement')
                      : (isXero ? `Confirm all lines, pick all ${taxLabel.toLowerCase()}s, and tick the empty-period box first` : 'Confirm all lines first')}
                    style={{...btn('primary'),padding:'8px 18px',fontSize:13,
                      opacity: canExport ? 1 : 0.38, cursor: canExport ? 'pointer' : 'default'}}>
                    {isXero ? '↓ Export Precoded CSV' : '↓ Export with Reference Codes'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Trial cap modal */}
      {showTrialCap && (
        <div onClick={() => setShowTrialCap(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9998,
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:C.card,borderRadius:18,padding:'36px 40px',width:420,maxWidth:'100%',
              boxShadow:'0 24px 64px rgba(0,0,0,0.4)',border:`1px solid ${C.bdr}`,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:14}}>🎯</div>
            <div style={{fontSize:20,fontWeight:700,color:C.t1,marginBottom:8}}>Trial Complete</div>
            <div style={{fontSize:13,color:C.t2,lineHeight:1.7,marginBottom:24}}>
              You've processed {TRIAL_LIMIT} statement{TRIAL_LIMIT !== 1 ? 's' : ''} — enough to see the full workflow.
              <br/>
              Get in touch to unlock full access.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
              <a href="mailto:csmm1964@gmail.com?subject=StatementAudit Pro — Full Access Request"
                style={{display:'block',padding:'13px',background:C.blu,color:'#fff',borderRadius:10,
                  fontSize:14,fontWeight:700,textDecoration:'none',transition:'opacity 0.15s'}}
                onMouseEnter={e => e.currentTarget.style.opacity='0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                Request full access →
              </a>
              <button onClick={() => setShowTrialCap(false)}
                style={{padding:'11px',background:'none',border:`1px solid ${C.bdr}`,borderRadius:10,
                  fontSize:13,color:C.t2,cursor:'pointer'}}>
                Continue browsing (review &amp; export only)
              </button>
            </div>
            <div style={{fontSize:11,color:C.t4,lineHeight:1.5}}>
              All {TRIAL_LIMIT} processed statements remain available to review and export.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
