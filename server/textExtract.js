'use strict';

// ── pdfjs-dist (ESM-only v4) loaded via dynamic import from this CJS module ──
// Node.js requires the worker to be set as a file:// URL — cannot use an empty
// string (triggers "fake worker failed") or a browser-relative path.
let _pdfjsPromise = null;
function getPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then(mod => {
        const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
        mod.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
        return mod;
      })
      .catch(() => null);
  }
  return _pdfjsPromise;
}

// Matches decimal amounts with OR without comma-thousands separators:
// 45.67 | 567.89 | 1,234.56 | 5462.60 | 12,345.00
// First alt: properly comma-grouped (real PDFs). Second alt: no-comma 4+ digits (some generators).
const MONEY_RE = /^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d{4,8}\.\d{2}$/;

// UK date formats: DD/MM/YYYY | DD/MM/YY | DD/MM/YY
const DATE_UK = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
// Month-name format: 01 Jan 2024 | 1 January 2024
const DATE_MONTH = /^\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}$/i;

// Rows whose text matches these are layout/header rows — skip them
const SKIP_RE   = /balance\s+(carried|brought)\s+forward|balance\s+[bc]\/[df]|opening\s+balance|closing\s+balance|account\s+summary/i;
const HEADER_RE = /\b(date|description|details|narrative|payments?\s*out|payments?\s*in|debit|credit|withdrawal|deposit|money\s+out|money\s+in|paid\s+out|paid\s+in)\b/i;
const MONTHS    = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

function parseMoney(s) {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function normaliseDate(s) {
  s = s.trim();
  if (DATE_MONTH.test(s)) {
    const m = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
    if (m) {
      const mon = (MONTHS[m[2].slice(0,3).toLowerCase()] || 1).toString().padStart(2, '0');
      return `${m[1].padStart(2,'0')}/${mon}/${m[3]}`;
    }
  }
  const parts = s.split('/');
  if (parts.length !== 3) return s;
  const [d, mo, y] = parts;
  const yr = y.length === 2 ? (parseInt(y, 10) < 50 ? 2000 + parseInt(y, 10) : 1900 + parseInt(y, 10)) : parseInt(y, 10);
  return `${d.padStart(2,'0')}/${mo.padStart(2,'0')}/${yr}`;
}

function isDate(text) {
  return DATE_UK.test(text.trim()) || DATE_MONTH.test(text.trim());
}

function isMoney(text) {
  return MONEY_RE.test(text.trim().replace(/,/g, ''));
}

// Group text items into rows by y-coordinate proximity.
// Items within `tolerance` points vertically are treated as the same line.
function groupIntoRows(items, tolerance = 4) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
  const rows = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - current[current.length - 1].y) <= tolerance) {
      current.push(sorted[i]);
    } else {
      rows.push(current.sort((a, b) => a.x - b.x));
      current = [sorted[i]];
    }
  }
  if (current.length) rows.push(current.sort((a, b) => a.x - b.x));
  return rows;
}

// Find the x-positions (right edges) of money columns using gap analysis.
// Bank statements are right-aligned: two amounts in the same column have the same
// right edge (rightX = tx + width) but different left edges. We cluster on rightX.
function findMoneyColumns(rows) {
  const rightXs = [];
  for (const row of rows) {
    for (const item of row) {
      if (isMoney(item.text)) rightXs.push(item.rightX);
    }
  }
  if (rightXs.length < 3) return null;

  rightXs.sort((a, b) => a - b);
  const GAP = 20; // points — distinct money columns are at least this far apart (right-edge to right-edge)
  const clusters = [[rightXs[0]]];
  for (let i = 1; i < rightXs.length; i++) {
    if (rightXs[i] - rightXs[i - 1] > GAP) clusters.push([]);
    clusters[clusters.length - 1].push(rightXs[i]);
  }
  if (clusters.length < 2) return null;

  // Centre of each cluster
  const centers = clusters
    .map(c => Math.round(c.reduce((s, v) => s + v, 0) / c.length))
    .sort((a, b) => a - b);

  // Rightmost cluster = running balance; next = paid-in (credit); next = paid-out (debit)
  return {
    balance: centers[centers.length - 1],
    credit:  centers.length >= 3 ? centers[centers.length - 2] : null,
    debit:   centers.length >= 3 ? centers[centers.length - 3] : null,
    colCount: centers.length,
    all: centers,
  };
}

// Is a text item's right edge close to a known column right-edge?
const nearR = (item, colX, tol = 20) => colX != null && Math.abs(item.rightX - colX) <= tol;

// Parse a single row into its components given known column positions.
function parseRow(row, cols) {
  let dateStr = null, debit = null, credit = null, balance = null;
  const descParts = [];

  for (const item of row) {
    const t = item.text.trim();
    if (!t) continue;

    if (isDate(t)) {
      dateStr = t;
      continue;
    }

    if (isMoney(t)) {
      const v = parseMoney(t.replace(/,/g, ''));
      if (v === null) continue;
      if (nearR(item, cols.balance))       { balance = v; continue; }
      if (nearR(item, cols.credit))        { credit  = v; continue; }
      if (nearR(item, cols.debit))         { debit   = v; continue; }
      // Two-column fallback: if no credit/debit column detected, item is left of balance → debit placeholder
      if (cols.colCount === 2 && item.rightX < cols.balance - 15) { debit = v; continue; }
      // Single-amount column that doesn't match any cluster — include as unknown
    }

    // Anything else and not in a money column area is description
    const inMoneyZone = (cols.balance && nearR(item, cols.balance, 60))
      || (cols.credit  && nearR(item, cols.credit,  60))
      || (cols.debit   && nearR(item, cols.debit,   60));
    if (!inMoneyZone) descParts.push(t);
  }

  return {
    dateStr,
    debit,
    credit,
    balance,
    desc: descParts.join(' ').replace(/\s+/g, ' ').trim(),
  };
}

// Detect whether a PDF has a usable machine-readable text layer, and if so extract
// transactions using generalised coordinate-based column clustering.
// Returns { transactions, colCount, source } or null (graceful degradation).
async function detectAndExtract(base64pdf) {
  const pdfjsLib = await getPdfjs();
  if (!pdfjsLib) return null;

  let pdf;
  try {
    const data = new Uint8Array(Buffer.from(base64pdf, 'base64'));
    pdf = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  } catch {
    return null;
  }

  // Gather all text items with x, y, and width across every page
  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    let page, viewport, content;
    try {
      page     = await pdf.getPage(p);
      viewport = page.getViewport({ scale: 1 });
      content  = await page.getTextContent({ includeMarkedContent: false });
    } catch { continue; }

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const [, , , , tx, ty] = item.transform;
      allItems.push({
        text:   item.str.trim(),
        x:      Math.round(tx),
        rightX: Math.round(tx + (item.width || 0)),
        y:      Math.round(viewport.height - ty), // flip to top-down
        page:   p,
      });
    }
  }

  // Minimum viable text layer: too few items → scanned PDF
  if (allItems.length < 12) return null;
  const moneyItems = allItems.filter(i => isMoney(i.text));
  if (moneyItems.length < 3) return null;

  const rows = groupIntoRows(allItems);
  const cols = findMoneyColumns(rows);
  if (!cols || cols.colCount < 2) return null;

  // Parse row by row into a pending-transaction accumulator
  const transactions = [];
  let idCounter   = 1;
  let pendingDate = null;
  let pendingDesc  = [];
  let pendingDebit  = null;
  let pendingCredit = null;
  let pendingBal    = null;

  const flush = () => {
    if (!pendingDate) return;
    if (pendingDebit == null && pendingCredit == null) {
      // Row with date but no amounts — keep pending (multi-line transactions)
      return;
    }
    transactions.push({
      id:          idCounter++,
      date:        normaliseDate(pendingDate),
      paymentType: null,
      description: pendingDesc.join(' ').replace(/\s+/g, ' ').trim() || null,
      payee:       null,
      debit:       pendingDebit  != null ? +Math.abs(pendingDebit).toFixed(2)  : null,
      credit:      pendingCredit != null ? +Math.abs(pendingCredit).toFixed(2) : null,
      balance:     pendingBal    != null ? +pendingBal.toFixed(2)              : null,
      wrapped:     false,
      ambiguous:   false,
      _source:     'text',
      _directionKnown: cols.colCount >= 3,
    });
    pendingDesc   = [];
    pendingDebit  = null;
    pendingCredit = null;
    pendingBal    = null;
  };

  for (const row of rows) {
    const rowText = row.map(i => i.text).join(' ');

    // Skip balance-label and header rows (only if no amounts on the row)
    if (SKIP_RE.test(rowText)) continue;
    const rowHasAmounts = row.some(i => isMoney(i.text));
    if (!rowHasAmounts && HEADER_RE.test(rowText)) continue;

    const { dateStr, debit, credit, balance, desc } = parseRow(row, cols);

    if (dateStr) {
      // A new date starts a new transaction — flush the previous
      flush();
      pendingDate = dateStr;
      if (desc) pendingDesc.push(desc);
      // If amounts are on the same row as the date, flush immediately
      if (debit != null || credit != null) {
        if (debit   != null) pendingDebit   = debit;
        if (credit  != null) pendingCredit  = credit;
        if (balance != null) pendingBal     = balance;
        flush();
        // Keep pendingDate so continuation rows (same-date multi-row) work
      }
    } else if (pendingDate != null) {
      // Continuation row — accumulate
      if (desc) pendingDesc.push(desc);
      if (pendingDebit  == null && debit   != null) pendingDebit   = debit;
      if (pendingCredit == null && credit  != null) pendingCredit  = credit;
      if (pendingBal    == null && balance != null) pendingBal     = balance;
      // If this continuation row supplies the amounts, flush now
      if (debit != null || credit != null) flush();
    }
    // Rows with no date and no pending context are skipped (page headers, etc.)
  }
  flush(); // Flush any trailing pending transaction

  if (!transactions.length) return null;

  return { transactions, colCount: cols.colCount, source: 'text-layer' };
}

module.exports = { detectAndExtract };
