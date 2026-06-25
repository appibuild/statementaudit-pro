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
        balanceBreaks.push({ fromDate: txList[prevIdx].date, toDate: txList[j].date, gap });
        const flip = findFlip(txList.slice(prevIdx + 1, j + 1), gap, txList[prevIdx].date, txList[j].date);
        if (flip) flipSuggestions.push(flip);
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
  return { ...prev, csvDebitTotal:deb, csvCreditTotal:crd, transactionCount:txList.length,
    calculatedClosing:calc, variance, txVar, balVar, derivedOpening, openingLikelyOff,
    accountTypeLikelyWrong, suggestedType,
    trueOpeningFromTop, openingAnchorsAgree, balanceBreaks, flipSuggestions, integrityChecked: idxFirstBal !== -1,
    reconciled: variance < 0.02 };
};

// Confidence score — a points checklist (NOT a probability). Start at 100 and deduct:
//   −40 if the statement does not reconcile (variance ≥ £0.02)
//   −15 if the closing balance could not be read off the statement (maths only half-checked)
//   Joined-from-2-lines (wrapped) rows: no penalty.
// "Worth a check" (ambiguous) rows are NOT scored here — they are a hard gate on the
// one-click path, handled by greenLit below. Clamped to 0–100.
const calcConfidence = rec => {
  if (!rec) return null;
  let score = 100;
  if (!rec.reconciled) score -= 40;
  if (rec.closingBalance == null) score -= 15;
  return Math.max(0, Math.min(100, score));
};

// Fast-track green light — all four must hold (Option A hard rule on ambiguous lines).
// The duplicate check is passed in live at display time, never baked into the stored score.
const greenLit = (score, rec, txList, hasDupe) =>
  score != null && score >= 95 &&
  !!rec?.reconciled &&
  !(txList || []).some(t => t.ambiguous) &&
  !hasDupe;

const buildQBO = txList => {
  const h = 'Date,Payment Type,Description,Payee,Debit,Credit,Nominal Code,Notes';
  return [h, ...txList.map(t => {
    const d = (t.description||'').replace(/"/g,'""');
    const p = (t.payee||'').replace(/"/g,'""');
    const n = (t.notes||'').replace(/"/g,'""');
    return `${t.date},${t.paymentType},"${d}","${p}",${t.debit??''},${t.credit??''},${t.nominalCode||''},"${n}"`;
  })].join('\r\n');
};

const buildXero = txList => {
  const h = 'Date,Amount,Payee,Description,Reference,Cheque Number,Analysis Code';
  return [h, ...txList.map(t => {
    const amt = t.credit != null ? t.credit : t.debit != null ? -t.debit : '';
    const p = (t.payee||'').replace(/"/g,'""');
    const d = (t.description||'').replace(/"/g,'""');
    return `${t.date},${amt},"${p}","${d}",${t.paymentType},,${t.nominalCode||''}`;
  })].join('\r\n');
};

const buildXeroPrecoded = txList => {
  const h = 'Date,Amount,Payee,Description,Reference,Account Code';
  return [h, ...txList.map(t => {
    const amt = t.credit != null ? t.credit : t.debit != null ? -t.debit : '';
    const p = (t.payee||'').replace(/"/g,'""');
    const d = (t.description||'').replace(/"/g,'""');
    return `${t.date},${amt},"${p}","${d}",${t.paymentType},${t.nominalCode||''}`;
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
  if (!s.period?.from) return `${bank}_${plat}${sfx}.csv`;
  const d = str => str.split('/').reverse().join('-');
  return `${bank}_${d(s.period.from)}_to_${d(s.period.to)}_${plat}${sfx}.csv`;
};

const dlFile = (content, name) => {
  const blob = new Blob(['\uFEFF' + content], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:name });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const buildAuditWorkbook = (s, rec) => {
  const tx = s.editedTransactions || s.transactions || [];
  const wb = XLSX.utils.book_new();

  // \u2500\u2500 Sheet 1: Audit Review \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const ar = [];
  ar.push(['Bank', s.bankName||'', 'Account', s.accountName||'']);
  ar.push(['Period', s.period ? `${s.period.from} \u2013 ${s.period.to}` : '', 'Account type', (ACCOUNT_TYPES[s.accountType]||ACCOUNT_TYPES.current).label]);
  ar.push([]);
  ar.push(['#','Date','Type','Description','Payee','Debit (out)','Credit (in)','Running balance','Nominal code','Notes','Flags']);
  tx.forEach((t, i) => {
    const flags = [t.flagged?'\u2691':'', t.ambiguous?'Check':'', t.wrapped?'Joined':''].filter(Boolean).join(', ');
    ar.push([i+1, t.date, t.paymentType, t.description||'', t.payee||'',
      t.debit!=null?t.debit:'', t.credit!=null?t.credit:'',
      t.balance!=null?t.balance:'', t.nominalCode||'', t.notes||'', flags]);
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
  ws1['!cols'] = [{wch:4},{wch:12},{wch:7},{wch:42},{wch:26},{wch:13},{wch:13},{wch:16},{wch:18},{wch:28},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Audit Review');

  // \u2500\u2500 Sheet 2: Import (clean) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const importLabel = s.platform === 'xero' ? 'Xero Import (clean)' : 'QBO Import (clean)';
  const ir = s.platform === 'xero'
    ? [['Date','Amount','Payee','Description','Reference','Cheque Number','Analysis Code'],
       ...tx.map(t => {
         const amt = t.credit!=null ? t.credit : t.debit!=null ? -t.debit : '';
         return [t.date, amt, t.payee||'', t.description||'', t.paymentType, '', t.nominalCode||''];
       })]
    : [['Date','Payment Type','Description','Payee','Debit','Credit','Nominal Code','Notes'],
       ...tx.map(t => [t.date, t.paymentType, t.description||'', t.payee||'', t.debit??'', t.credit??'', t.nominalCode||'', t.notes||''])];
  const ws2 = XLSX.utils.aoa_to_sheet(ir);
  ws2['!cols'] = [{wch:12},{wch:14},{wch:42},{wch:26},{wch:13},{wch:13},{wch:18},{wch:28}];
  XLSX.utils.book_append_sheet(wb, ws2, importLabel);

  return wb;
};

const dlWorkbook = (s, rec) => {
  const wb = buildAuditWorkbook(s, rec);
  const bank = (s.bankName||'Bank').replace(/\s+/g,'_');
  const d = str => str.split('/').reverse().join('-');
  const name = s.period?.from
    ? `${bank}_${d(s.period.from)}_to_${d(s.period.to)}_Audit.xlsx`
    : `${bank}_Audit.xlsx`;
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

// ─── Main Component ────────────────────────────────────────────────────────────
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
  const [qboImportRows, setQboImportRows] = useState(null); // null=closed, array=mapping modal open

  const stmtsRef       = useRef([]);
  const fileInputRef   = useRef(null);
  const rulesInputRef  = useRef(null);
  const qboInputRef    = useRef(null);
  const payeeMemoryRef = useRef({});

  useEffect(() => { stmtsRef.current = stmts; }, [stmts]);
  useEffect(() => {
    payeeMemoryRef.current = payeeMemory;
    localStorage.setItem('sa_payeeMemory', JSON.stringify(payeeMemory));
  }, [payeeMemory]);

  useEffect(() => {
    const l = document.createElement('link');
    l.rel  = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(l);
    return () => document.head.removeChild(l);
  }, []);

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
      const room = Math.max(0, 20 - prev.length);
      return [...prev, ...pdfs.slice(0, room).map(file => ({
        id:uid(), file, filename:file.name, status:'queued',
        accountType:'current', platform:'qbo',
        bankName:'', accountName:'', period:null,
        openingBalance:null, closingBalance:null,
        transactions:[], editedTransactions:null, reconciliation:null, crossCheck:null, error:null, rawResponse:null,
      }))];
    });
    setTab('queue');
  }, []);

  // ── Claude API ─────────────────────────────────────────────────────────
  const processOne = useCallback(async id => {
    const stmt = stmtsRef.current.find(s => s.id === id);
    if (!stmt || stmt.status === 'processing') return;
    if (stmt.status === 'approved' && !window.confirm('Re-running will reset this approved statement to For Review and clear all edits. Continue?')) return;
    updateS(id, { status:'processing', error:null, rawResponse:null });
    let capturedRaw = ''; // session-only React state — never persisted; cleared on re-run and on success
    try {
      const b64  = await toBase64(stmt.file);
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
        const remembered = payeeMemoryRef.current[normKey(t.payee, t.description)];
        // LAYER-2-HOOK: model-inferred suggestion for unrecognised payees.
        // Build only when real-user data proves new-client unfamiliarity (not re-coding) is the bottleneck.
        return {
          ...t, id:t.id??i+1, flagged:false, notes:'',
          nominalCode: remembered || (debit != null ? 'Misc Expense' : 'Misc Revenue'),
          codeSource: remembered ? 'remembered' : 'holding',
          rememberCode: false,
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
        reconciliation: rec0,
        confidenceScore: calcConfidence(rec0),
        crossCheck: api._textExtract?.crossCheck ?? null,
        rawResponse: null,
      });
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

  // Edit a statement-level balance (opening / closing-on-statement), then re-reconcile and re-score.
  // Lets a human correct a misread balance so the statement reconciles — the gate, working.
  const commitBalEdit = () => {
    if (!balEdit) return;
    const { sid, field } = balEdit;
    const num = balVal.trim() === '' ? null : +parseFloat(balVal).toFixed(2);
    setStmts(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const prevRec = { ...(s.reconciliation || {}), [field]: num, openingAdjusted: false, printedOpening: null };
      const rec = recalc(getTx(s), prevRec, s.accountType);
      return { ...s, [field]: num, reconciliation: rec, confidenceScore: calcConfidence(rec) };
    }));
    setBalEdit(null);
  };

  // One-click: accept the opening balance the app worked out from the closing balance.
  // Remember the figure printed on the statement so we can explain the difference, not hide it.
  const useDerivedOpening = sid => setStmts(prev => prev.map(s => {
    if (s.id !== sid || s.reconciliation?.derivedOpening == null) return s;
    const num     = s.reconciliation.derivedOpening;
    const printed = s.reconciliation.openingBalance;
    const prevRec = { ...s.reconciliation, openingBalance: num, printedOpening: printed, openingAdjusted: true };
    const rec = recalc(getTx(s), prevRec, s.accountType);
    return { ...s, openingBalance: num, reconciliation: rec, confidenceScore: calcConfidence(rec) };
  }));

  // One-click: switch the account type and re-reconcile straight away (no re-extraction).
  const applyAccountType = (sid, type) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const rec = recalc(getTx(s), s.reconciliation, type);
    return { ...s, accountType: type, reconciliation: rec, confidenceScore: calcConfidence(rec) };
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
      return {...s, editedTransactions:updated, reconciliation:rec, confidenceScore:calcConfidence(rec)};
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
      } catch {}
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
      } catch {}
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const deleteTx = (sid, tid) => setStmts(prev => prev.map(s => {
    if (s.id !== sid) return s;
    const base = (s.editedTransactions || s.transactions || []).filter(t => t.id !== tid);
    const rec  = recalc(base, s.reconciliation, s.accountType);
    return {...s, editedTransactions:base, reconciliation:rec, confidenceScore:calcConfidence(rec)};
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
    return {...s, editedTransactions: base, reconciliation: rec, confidenceScore: calcConfidence(rec)};
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
    updateS(id, {status:'approved'});
    const nextStmt = stmtsRef.current.find(s => s.status === 'review' && s.id !== id);
    if (nextStmt) setActiveId(nextStmt.id);
    else setTab('export');
  };
  const reject = id => updateS(id, {status:'rejected'});

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

  // Green ⚡ badge for a clean statement (≥95); amber NN/100 otherwise.
  const ConfidenceBadge = ({score, size='sm'}) => {
    if (score == null) return null;
    const hi = score >= 95;
    const big = size === 'lg';
    return <span style={{display:'inline-flex',alignItems:'center',gap:4,
      fontSize:big?13:10,fontWeight:700,padding:big?'4px 11px':'2px 8px',borderRadius:big?7:4,
      letterSpacing:'0.04em',fontFamily:'Inter,sans-serif',
      color:hi?C.grn:C.amb,background:hi?C.grnDim:C.ambDim,border:`1px solid ${hi?C.grnBrd:C.ambBrd}`}}>
      {hi ? <>⚡ {big?'Passes every check':'High conf'}</> : `${score}/100`}
    </span>;
  };

  // ─────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────────
  const renderUpload = () => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:24}}>
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
          Up to 20 files · Any UK bank<br/>
          Current · Savings · Credit Card · Loan / Mortgage<br/>
          Export to QuickBooks Online or Xero
        </div>
        <span style={{...btn('primary'),display:'inline-block'}}>Browse Files</span>
      </div>
      <div style={{fontSize:12,color:C.t3,textAlign:'center',lineHeight:1.7,maxWidth:460}}>
        Set account type and export platform per file in the Queue.<br/>
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
            {stmts.length} file{stmts.length!==1?'s':''} · Set account type and platform before processing · Max 20 files
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => fileInputRef.current?.click()} style={btn('outline')}>+ Add Files</button>
          {cnts.errors > 0 && (
            <button onClick={runErrored} disabled={running} style={btn('outline',running)}>↻ Run errored ({cnts.errors})</button>
          )}
          {cnts.queued > 0 && (
            <button onClick={processAll} disabled={running} style={btn('primary',running)}>
              {running ? '⟳ Processing…' : `▶ Process All (${cnts.queued})`}
            </button>
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
              <select value={s.platform} disabled={editLock}
                onChange={e => updateS(s.id,{platform:e.target.value})}
                style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'5px 8px',
                  color:s.platform==='xero'?'#13B5EA':'#2CA01C',fontSize:11,outline:'none',
                  cursor:editLock?'not-allowed':'pointer',opacity:editLock?0.6:1}}>
                <option value="qbo">QuickBooks Online</option>
                <option value="xero">Xero</option>
              </select>
              <Pill status={s.status}/>
              <div style={{display:'flex',gap:5}}>
                {['queued','error','rejected'].includes(s.status) && (
                  <button onClick={() => processOne(s.id)} style={{...btn('outline'),padding:'4px 10px',fontSize:11}}>Run</button>
                )}
                {['review','approved'].includes(s.status) && (
                  <button onClick={() => {setActiveId(s.id);setTab('audit');}} style={{...btn('outline'),padding:'4px 10px',fontSize:11}}>View</button>
                )}
                {s.status !== 'processing' && (
                  <button onClick={() => setStmts(p => p.filter(x => x.id !== s.id))}
                    style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:13,padding:'2px 4px'}}>✕</button>
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
    const reviewable = stmts.filter(s => ['review','approved','rejected'].includes(s.status));
    if (!reviewable.length) return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:14,color:C.t2}}>
        <div style={{fontSize:40}}>🔍</div>
        <div style={{fontSize:16,color:C.t1}}>No statements ready for review</div>
        <div style={{fontSize:13}}>Process statements in the Queue first</div>
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

    return (
      <div style={{display:'flex',height:'100%',gap:0}}>
        {/* Sidebar */}
        <div style={{width:195,flexShrink:0,borderRight:`1px solid ${C.bdr}`,overflowY:'auto',padding:'10px 8px',background:C.surf}}>
          <div style={{fontSize:11,color:C.t3,textTransform:'uppercase',letterSpacing:'0.07em',padding:'4px 8px 10px',fontWeight:600}}>Statements</div>
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
                </div>
              </div>
            );
          })}
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
                  <ConfidenceBadge score={score}/>
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
                  <button onClick={() => processOne(s.id)} disabled={running}
                    style={{...btn('outline',running),padding:'4px 11px',fontSize:11}}>↻ Re-run</button>
                  <button onClick={() => setShowPdf(v => !v)}
                    style={{...btn(showPdf?'success':'outline'),padding:'4px 11px',fontSize:11}}>📄 {showPdf?'Hide PDF':'Show PDF'}</button>
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                <button onClick={() => idx>0 && setActiveId(reviewable[idx-1].id)} disabled={idx<=0} style={btn('outline')}>← Prev</button>
                <span style={{fontSize:11,color:C.t2,fontFamily:'JetBrains Mono,monospace',padding:'0 4px'}}>{idx+1}/{reviewable.length}</span>
                <button onClick={() => idx<reviewable.length-1 && setActiveId(reviewable[idx+1].id)} disabled={idx>=reviewable.length-1} style={btn('outline')}>Next →</button>
                {canEdit && <>
                  <button onClick={() => reject(s.id)} style={btn('danger')}>✕ Reject</button>
                  {!fastTrack && (rec?.reconciled
                    ? <button onClick={() => { dlFile(buildCSV(s), makeName(s)); approve(s.id); }} style={btn('primary')}>✓ Approve &amp; Export</button>
                    : <span style={{padding:'6px 14px',borderRadius:9,background:C.redDim,color:C.red,border:`1px solid ${C.redBrd}`,fontWeight:600,fontSize:13,fontFamily:'Inter,sans-serif',lineHeight:1.4}}>⛔ Fix required</span>
                  )}
                  {!fastTrack && txList.length > 0 && rec && (
                    <button onClick={() => dlWorkbook(s, s.reconciliation)} style={{...btn('outline'),borderColor:C.grn,color:C.grn}}>↓ Audit Workbook</button>
                  )}
                </>}
                {s.status==='approved' && <>
                  <button onClick={() => dlFile(buildCSV(s), makeName(s))} style={btn('success')}>↓ Re-download CSV</button>
                  <button onClick={() => dlWorkbook(s, s.reconciliation)} style={{...btn('outline'),borderColor:C.grn,color:C.grn}}>↓ Audit Workbook</button>
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
            <div style={{flexShrink:0,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.t3,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>The numbers — these must add up before you approve</div>
              <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'18px 20px'}}>
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
                {(rec.statementPaymentsOut > 0 || rec.statementPaymentsIn > 0) && (() => {
                  const sOut = rec.statementPaymentsOut || 0;
                  const sIn  = rec.statementPaymentsIn  || 0;
                  const cDeb = rec.csvDebitTotal  || 0;
                  const cCrd = rec.csvCreditTotal || 0;
                  const oGap = +(Math.abs(cDeb - sOut)).toFixed(2);
                  const iGap = +(Math.abs(cCrd - sIn)).toFixed(2);
                  return (
                    <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.bdr}`}}>
                      <div style={{fontSize:11,color:C.t3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,fontWeight:600}}>Statement figures vs. your CSV</div>
                      <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr',gap:'5px 18px',alignItems:'center'}}>
                        <div/>
                        <div style={{fontSize:10,color:C.t3,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.05em'}}>Statement</div>
                        <div style={{fontSize:10,color:C.t3,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.05em'}}>Your CSV</div>
                        <div style={{fontSize:10,color:C.t3,fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.05em'}}>Gap</div>
                        <div style={{fontSize:12,color:C.t2,whiteSpace:'nowrap'}}>Payments out</div>
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:C.t1}}>{fmtCcy(sOut)}</div>
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:oGap>=0.02?C.red:C.grn}}>{fmtCcy(cDeb)}</div>
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:oGap>=0.02?C.red:C.t3}}>{oGap>=0.02?fmtCcy(oGap):'—'}</div>
                        <div style={{fontSize:12,color:C.t2,whiteSpace:'nowrap'}}>Payments in</div>
                        <div style={{fontSize:13,fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:C.t1}}>{fmtCcy(sIn)}</div>
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
            </div>
          )}

          {/* Fast-track panel — shown only when all four green-light conditions hold.
              The reconciliation strip above stays visible; this adds the one-click approve.
              The ⚡ button calls the EXACT same handler as the standard Approve & Export. */}
          {fastTrack && (
            <div style={{flexShrink:0,marginBottom:12,background:C.grnDim,border:`1px solid ${C.grnBrd}`,borderRadius:12,padding:'18px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
                <ConfidenceBadge score={score} size="lg"/>
                <span style={{fontSize:15,fontWeight:600,color:C.t1}}>This statement passes every check — reconciled, nothing flagged as unsure, no duplicates.</span>
              </div>
              <div style={{fontSize:13,color:C.t2,marginBottom:14,fontFamily:'JetBrains Mono,monospace'}}>
                Confidence: {score}/100 · {s.bankName||s.filename} · {atCfg.label} · {platLabel}
                {s.period && <> · {s.period.from} — {s.period.to}</>} · {txList.length} txn
              </div>
              <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                <button onClick={() => { dlFile(buildCSV(s), makeName(s)); approve(s.id); }}
                  style={{...btn('primary'),fontSize:15,padding:'12px 22px'}}>⚡ Approve &amp; Export</button>
                <button onClick={() => dlWorkbook(s, rec)}
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
                      {flip ? ' — likely sign flip highlighted in amber below. Accept the suggestion to correct it.' : ' — check this stretch against the statement.'}
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
                  {(() => {
                    const oGap = +(Math.abs((rec.csvDebitTotal||0) - (rec.statementPaymentsOut||0))).toFixed(2);
                    const iGap = +(Math.abs((rec.csvCreditTotal||0) - (rec.statementPaymentsIn||0))).toFixed(2);
                    if (oGap >= 0.02 && Math.abs(oGap - iGap) < 0.02)
                      return <div>• Payments Out and Payments In are both off by <strong>£{oGap.toFixed(2)}</strong> — equal-and-opposite gaps are the signature of a transaction entered in the wrong direction. Look for a row where the amount is close to £{oGap.toFixed(2)}.</div>;
                    return null;
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
                  {['#','Date','Type','Description','Payee','Debit','Credit','Nominal','Notes','⚑','✕'].map((h,i) => (
                    <th key={i} style={{padding:'12px 12px',textAlign:[5,6].includes(i)?'right':'left',
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
                  const td      = tdBase(ri, t.flagged || t.ambiguous || isRepeat(t.id) || !!flipSug, dp);  // flip candidate → amber
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
                      <td style={{...td,width:112}} onClick={() => canEdit && startEdit(s.id,t.id,'nominalCode',t.nominalCode)}>
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
                      </td>
                      <td style={{...td,maxWidth:130}} onClick={() => canEdit && startEdit(s.id,t.id,'notes',t.notes)}>
                        {isEd(t.id,'notes') ? <EI field="notes"/>
                          : <span title={t.notes} style={{color:t.notes?C.t1:C.t3}}>{t.notes||'—'}</span>}
                      </td>
                      <td style={{...td,textAlign:'center',width:30}}>
                        <button onClick={() => toggleFlag(s.id,t.id)}
                          style={{background:'none',border:'none',cursor:'pointer',color:t.flagged?C.amb:C.t3,fontSize:13,padding:'1px 3px'}}>⚑</button>
                      </td>
                      <td style={{...td,textAlign:'center',width:30}}>
                        {canEdit && <button onClick={() => deleteTx(s.id,t.id)}
                          style={{background:'none',border:'none',cursor:'pointer',color:C.t3,fontSize:12,padding:'1px 3px'}}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
            </div>
            {showPdf && (
              <div style={{flex:1,minWidth:0,borderRadius:9,border:`1px solid ${C.bdr}`,overflow:'hidden',background:C.card,display:'flex',flexDirection:'column'}}>
                {pdfUrl ? (
                  <object data={pdfUrl} type="application/pdf" style={{width:'100%',height:'100%',border:'none'}}>
                    <div style={{padding:20,fontSize:13,color:C.t2}}>Can't show the PDF inline here. <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{color:C.blu,fontWeight:600}}>Open it in a new tab →</a></div>
                  </object>
                ) : <div style={{padding:20,fontSize:13,color:C.t3}}>Loading PDF…</div>}
              </div>
            )}
          </div>
          )}
        </div>
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

  // ─────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────
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
              <button onClick={() => dlFile(buildQBO(qboApproved.flatMap(s=>getTx(s)).sort((a,b)=>pDate(a.date)-pDate(b.date))), 'Merged_QBO.csv')}
                style={btn('outline')}>↓ Merge QBO ({qboApproved.length})</button>
            )}
            {xeroApproved.length > 1 && (
              <button onClick={() => dlFile(buildXero(xeroApproved.flatMap(s=>getTx(s)).sort((a,b)=>pDate(a.date)-pDate(b.date))), 'Merged_Xero.csv')}
                style={btn('outline')}>↓ Merge Xero ({xeroApproved.length})</button>
            )}
            {xeroApproved.length > 1 && (
              <button onClick={() => dlFile(buildXeroPrecoded(xeroApproved.flatMap(s=>getTx(s)).sort((a,b)=>pDate(a.date)-pDate(b.date))), 'Merged_Xero_Precoded.csv')}
                style={btn('outline')}>↓ Merged Xero (pre-coded)</button>
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
                  <button onClick={() => dlFile(buildCSV(s), makeName(s))} style={btn('primary')}>↓ Download</button>
                  {s.platform==='xero' && (
                    <button onClick={() => dlFile(buildXeroPrecoded(getTx(s)), makeName(s,'PRECODED'))} style={btn('outline')}>↓ Pre-coded</button>
                  )}
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
              <button onClick={exportRules} disabled={!Object.keys(payeeMemory).length} style={btn('outline')}>↓ Save Rules</button>
              <button onClick={() => rulesInputRef.current?.click()} style={btn('outline')}>↑ Import Rules (.json)</button>
              <button onClick={() => qboInputRef.current?.click()} style={btn('outline')}>↑ Import QBO Rules (.xls)</button>
              <button onClick={() => { if(window.confirm('Clear all payee→code rules?')) setPayeeMemory({}); }}
                disabled={!Object.keys(payeeMemory).length} style={btn('danger')}>Clear All</button>
              <input ref={rulesInputRef} type="file" accept=".json" style={{display:'none'}} onChange={importRules}/>
              <input ref={qboInputRef}   type="file" accept=".xls,.xlsx" style={{display:'none'}} onChange={importRulesQBO}/>
            </div>
          </div>
          {/* Backup help panel */}
          <div style={{background:C.ambDim,border:`1px solid ${C.ambBrd}`,borderRadius:7,padding:'10px 14px',fontSize:11,color:C.t2,lineHeight:1.6}}>
            <span style={{fontWeight:600,color:C.amb}}>⚡ Backup your rules — do this now:</span>
            {' '}Rules are stored in this browser only. A backup file downloads automatically to your Downloads folder each time you Approve.{' '}
            <strong>Drag that file to OneDrive, Google Drive, or iCloud Drive after each session</strong> — if you clear your browser data or switch devices, the backup is your only recovery.
            <br/>To restore: click <em>Import Rules (.json)</em> and select your backup file.
            To bring in rules already set up in QBO: export them from <em>Transactions → Bank Transactions → Rules → Export Rules</em>, then click <em>Import QBO Rules (.xls)</em>.
          </div>
        </div>

        {/* Import guides */}
        <div style={{flexShrink:0,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[
            { title:'QuickBooks Online', color:'#2CA01C', steps:[
              'Banking → Upload transactions → Select bank account',
              'Upload CSV — QBO auto-detects column layout',
              'Map: Date · Payment Type · Description · Payee · Debit · Credit',
              'Review auto-matched transactions against existing bank rules',
              'Accept matches, categorise new transactions, click Add All',
            ]},
            { title:'Xero', color:'#13B5EA', steps:[
              'Accounting → Bank Accounts → Select account → Import Statement',
              'Upload CSV — Xero reads Date, Amount, Payee, Description',
              'Amount: negative = money out, positive = money in',
              'Analysis Code column maps to Xero Tracking Categories',
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
  // LAYOUT
  // ─────────────────────────────────────────────────────────────────────
  const navItems = [
    {id:'upload', n:'1', label:'Upload',  badge:null},
    {id:'queue',  n:'2', label:'Process', badge:stmts.length||null},
    {id:'audit',  n:'3', label:'Review',  badge:cnts.review||null},
    {id:'export', n:'4', label:'Export',  badge:cnts.approved||null},
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
            <div style={{fontSize:13,color:C.t3}}>Bank statements → QuickBooks &amp; Xero</div>
          </div>
        </div>
        <nav style={{display:'flex',gap:8}}>
          {navItems.map(n => {
            const on   = tab===n.id;
            const done = stepDone(n.id);
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
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
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'hidden',padding:tab==='audit'?'22px 22px 22px 0':22}}>
        {tab==='upload' && renderUpload()}
        {tab==='queue'  && renderQueue()}
        {tab==='audit'  && renderAudit()}
        {tab==='export' && renderExport()}
      </div>
      {renderQboImportModal()}
    </div>
  );
}
