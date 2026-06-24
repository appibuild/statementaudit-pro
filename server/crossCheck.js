'use strict';

// Tolerance for floating-point amount comparison
const AMT_TOL = 0.015; // £0.015 — covers rounding at the last pence

// Compare the LLM transaction list against the text-layer extraction.
// Returns a structured result the client renders directly.
//
// Status values:
//   'agree'          — both paths produced same count, all amounts/directions match
//   'partial'        — same count, but one or more transactions differ
//   'count_mismatch' — different number of transactions (most serious signal)
//   'unavailable'    — text layer returned null; LLM path is the only read
//
// The flagged array contains one entry per disagreeing transaction with:
//   { index, txId, date, issues: [{ field, llm, text }] }
// No auto-winner is picked — human reviews flagged rows.

function crossCheck(llmTxs, textResult) {
  if (!textResult || !textResult.transactions || !textResult.transactions.length) {
    return {
      status:     'unavailable',
      flagged:    [],
      llmCount:   llmTxs.length,
      textCount:  0,
      colCount:   null,
    };
  }

  const textTxs   = textResult.transactions;
  const llmCount  = llmTxs.length;
  const textCount = textTxs.length;
  const colCount  = textResult.colCount;
  const directionKnown = colCount >= 3;

  if (llmCount !== textCount) {
    return {
      status:   'count_mismatch',
      flagged:  [],
      llmCount,
      textCount,
      colCount,
      message:  `AI read ${llmCount} transactions; text layer read ${textCount}. Count mismatch — check for dropped or merged rows.`,
    };
  }

  const flagged = [];

  for (let i = 0; i < llmCount; i++) {
    const l = llmTxs[i];
    const t = textTxs[i];
    const issues = [];

    const lDebit  = l.debit  ?? 0;
    const lCredit = l.credit ?? 0;
    const tDebit  = t.debit  ?? 0;
    const tCredit = t.credit ?? 0;

    // Amount mismatch (direction-independent — compare total value)
    if (Math.abs(lDebit - tDebit) > AMT_TOL) {
      issues.push({ field: 'debit', llm: lDebit, text: tDebit });
    }
    if (Math.abs(lCredit - tCredit) > AMT_TOL) {
      issues.push({ field: 'credit', llm: lCredit, text: tCredit });
    }

    // Direction mismatch — only when the text layer has 3+ columns (can determine direction)
    if (directionKnown) {
      const lIsDebit  = lDebit  > 0 && lCredit === 0;
      const lIsCredit = lCredit > 0 && lDebit  === 0;
      const tIsDebit  = tDebit  > 0 && tCredit === 0;
      const tIsCredit = tCredit > 0 && tDebit  === 0;
      if ((lIsDebit && tIsCredit) || (lIsCredit && tIsDebit)) {
        issues.push({
          field: 'direction',
          llm:  lIsDebit  ? 'debit'  : 'credit',
          text: tIsDebit  ? 'debit'  : 'credit',
        });
      }
    }

    // Running balance mismatch — when both paths captured a balance for this row
    if (l.balance != null && t.balance != null) {
      if (Math.abs(l.balance - t.balance) > AMT_TOL) {
        issues.push({ field: 'balance', llm: l.balance, text: t.balance });
      }
    }

    if (issues.length) {
      flagged.push({ index: i, txId: l.id, date: l.date, issues });
    }
  }

  return {
    status:    flagged.length === 0 ? 'agree' : 'partial',
    flagged,
    llmCount,
    textCount,
    colCount,
    directionKnown,
  };
}

module.exports = { crossCheck };
