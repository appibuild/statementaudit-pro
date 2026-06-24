'use strict';
// Generates synthetic bank statement PDFs with FICTIONAL data for regression testing.
// All names, amounts, dates and references are invented — no real personal data.
// Run: node generate.js
// Outputs: fixtures/layout-3col-current.pdf   (3-column current account)
//          fixtures/layout-3col-credit.pdf    (3-column credit card)
// Each fixture has a matching expected/*.json ground-truth file.

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const EXPECTED_DIR = path.join(__dirname, 'expected');
fs.mkdirSync(FIXTURES_DIR, { recursive: true });
fs.mkdirSync(EXPECTED_DIR, { recursive: true });

// ─── Layout constants (A4 portrait, 595×842 points) ─────────────────────────
// All amounts are RIGHT-aligned within their column box so the right edge is the
// column identifier — matching how pdfjs-dist reports coordinates in real bank PDFs.
const PAGE_W = 595;
const MARGIN  = 40;

// Column right-edges (these are the values textExtract.js clusters on)
const COL = {
  dateLeft:    MARGIN,         // Date: left-aligned from x=40
  descLeft:    130,            // Description: left-aligned from x=130
  debitRight:  400,            // Paid Out column right edge
  creditRight: 480,            // Paid In column right edge
  balRight:    PAGE_W - MARGIN, // Balance column right edge
};

// Format a number as UK accounting style: comma-thousands, 2 decimal places
// This matches how real bank PDFs render amounts.
function fmtAmt(n) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Draw right-aligned text ending at a given x-position
function rText(doc, text, rightX, y) {
  const w = doc.widthOfString(text);
  doc.text(text, rightX - w, y);
}

// ─── Fixture 1: 3-column current account ────────────────────────────────────
const TRANSACTIONS_CURRENT = [
  { date: '01/06/2024', desc: 'OPENING BALANCE',                  debit: null,    credit: null,   balance: 2450.00, isBalance: true },
  { date: '03/06/2024', desc: 'TESCO STORES PETROL STATION',      debit: 67.40,   credit: null,   balance: 2382.60 },
  { date: '05/06/2024', desc: 'MERIDIAN DENTAL CARE',             debit: 120.00,  credit: null,   balance: 2262.60 },
  { date: '07/06/2024', desc: 'SALARY PAYMENT FABRIKA LTD',       debit: null,    credit: 3200.00,balance: 5462.60 },
  { date: '10/06/2024', desc: 'CORNISH GAS SUPPLY DD',            debit: 89.50,   credit: null,   balance: 5373.10 },
  { date: '12/06/2024', desc: 'WESTMOOR COUNCIL TAX DD',          debit: 145.00,  credit: null,   balance: 5228.10 },
  { date: '14/06/2024', desc: 'HARGREAVES COFFEE SHOP',           debit: 12.60,   credit: null,   balance: 5215.50 },
  { date: '15/06/2024', desc: 'REFUND CORNISH GAS SUPPLY',        debit: null,    credit: 15.00,  balance: 5230.50 },
  { date: '18/06/2024', desc: 'NORTHGATE BROADBAND SO',           debit: 34.99,   credit: null,   balance: 5195.51 },
  { date: '20/06/2024', desc: 'FALMOUTH HARDWARE STORE',          debit: 78.32,   credit: null,   balance: 5117.19 },
  { date: '22/06/2024', desc: 'VISA PURCHASE STOCKHOLM SEK 450',  debit: 38.24,   credit: null,   balance: 5078.95 },
  { date: '25/06/2024', desc: 'PENROSE INSURANCE ANNUAL RENEWAL', debit: 420.00,  credit: null,   balance: 4658.95 },
  { date: '28/06/2024', desc: 'TRURO MARKET DIRECT PAYMENT',      debit: 56.80,   credit: null,   balance: 4602.15 },
  { date: '30/06/2024', desc: 'CLOSING BALANCE',                  debit: null,    credit: null,   balance: 4602.15, isBalance: true },
];
const CURRENT_OPEN  = 2450.00;
const CURRENT_CLOSE = 4602.15;

function buildCurrentPDF() {
  const doc  = new PDFDocument({ size: 'A4', margin: 0 });
  const file = path.join(FIXTURES_DIR, 'layout-3col-current.pdf');
  doc.pipe(fs.createWriteStream(file));

  doc.font('Helvetica').fontSize(14);
  doc.text('CORNWALL BANK PLC', MARGIN, 40);
  doc.font('Helvetica').fontSize(10);
  doc.text('Current Account Statement', MARGIN, 60);
  doc.text('Account Name: JOHN A TESTINGTON', MARGIN, 75);
  doc.text('Account Number: 12345678  Sort Code: 10-20-30', MARGIN, 88);
  doc.text('Statement Period: 01/06/2024 to 30/06/2024', MARGIN, 101);
  doc.text(`Opening Balance: ${CURRENT_OPEN.toFixed(2)}`, MARGIN, 114);
  doc.text(`Closing Balance: ${CURRENT_CLOSE.toFixed(2)}`, MARGIN, 127);

  // Column headers
  let y = 155;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Date',        COL.dateLeft,  y);
  doc.text('Description', COL.descLeft,  y);
  rText(doc, 'Paid Out', COL.debitRight,  y);
  rText(doc, 'Paid In',  COL.creditRight, y);
  rText(doc, 'Balance',  COL.balRight,    y);

  // Separator line
  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).stroke();
  y += 6;

  doc.font('Helvetica').fontSize(9);
  for (const tx of TRANSACTIONS_CURRENT) {
    if (tx.isBalance) continue; // skip balance label rows — they are not transactions
    doc.text(tx.date, COL.dateLeft, y);
    // Multi-word descriptions — wrap within the description column
    doc.text(tx.desc, COL.descLeft, y, { width: 210, lineBreak: false });
    if (tx.debit  != null) rText(doc, fmtAmt(tx.debit),  COL.debitRight,  y);
    if (tx.credit != null) rText(doc, fmtAmt(tx.credit), COL.creditRight, y);
    if (tx.balance != null) rText(doc, fmtAmt(tx.balance), COL.balRight,  y);
    y += 17;
    if (y > 780) { doc.addPage(); y = 40; }
  }

  doc.end();
  return file;
}

// ─── Fixture 2: 3-column credit card ────────────────────────────────────────
const TRANSACTIONS_CREDIT = [
  { date: '02/07/2024', desc: 'PREVIOUS BALANCE',                     debit: null,    credit: null,  balance: 340.50, isBalance: true },
  { date: '02/07/2024', desc: 'PEMBERLEY GROCERS TRURO',              debit: 45.32,   credit: null,  balance: 385.82 },
  { date: '05/07/2024', desc: 'WESTCOTT PETROL REDRUTH',              debit: 78.00,   credit: null,  balance: 463.82 },
  { date: '08/07/2024', desc: 'PAYMENT RECEIVED THANK YOU',           debit: null,    credit: 200.00,balance: 263.82 },
  { date: '10/07/2024', desc: 'SUBSCRIPTION CLOUDVAULT MONTHLY',      debit: 12.99,   credit: null,  balance: 276.81 },
  { date: '14/07/2024', desc: 'REFUND PEMBERLEY GROCERS TRURO',       debit: null,    credit: 22.50, balance: 254.31 },
  { date: '17/07/2024', desc: 'HEATHROW AIRPORT TERMINAL 3',          debit: 28.00,   credit: null,  balance: 282.31 },
  { date: '19/07/2024', desc: 'PURCHASE EUR 120.00 AMSTERDAM CAFE',   debit: 103.47,  credit: null,  balance: 385.78 },
  { date: '22/07/2024', desc: 'MONTHLY INTEREST CHARGE',              debit: 8.54,    credit: null,  balance: 394.32 },
  { date: '31/07/2024', desc: 'NEW BALANCE',                          debit: null,    credit: null,  balance: 394.32, isBalance: true },
];
const CREDIT_OPEN  = 340.50;
const CREDIT_CLOSE = 394.32;

function buildCreditPDF() {
  const doc  = new PDFDocument({ size: 'A4', margin: 0 });
  const file = path.join(FIXTURES_DIR, 'layout-3col-credit.pdf');
  doc.pipe(fs.createWriteStream(file));

  doc.font('Helvetica').fontSize(14);
  doc.text('MERIDIAN CARD SERVICES', MARGIN, 40);
  doc.font('Helvetica').fontSize(10);
  doc.text('Credit Card Statement', MARGIN, 60);
  doc.text('Cardholder: SARAH B FICTIONALTON', MARGIN, 75);
  doc.text('Account Number: **** **** **** 9876', MARGIN, 88);
  doc.text('Statement Period: 02/07/2024 to 31/07/2024', MARGIN, 101);
  doc.text(`Previous Balance: ${CREDIT_OPEN.toFixed(2)}`, MARGIN, 114);
  doc.text(`New Balance: ${CREDIT_CLOSE.toFixed(2)}`, MARGIN, 127);

  let y = 155;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Date',        COL.dateLeft,  y);
  doc.text('Description', COL.descLeft,  y);
  rText(doc, 'Debit',   COL.debitRight,  y);
  rText(doc, 'Credit',  COL.creditRight, y);
  rText(doc, 'Balance', COL.balRight,    y);

  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).stroke();
  y += 6;

  doc.font('Helvetica').fontSize(9);
  for (const tx of TRANSACTIONS_CREDIT) {
    if (tx.isBalance) continue;
    doc.text(tx.date, COL.dateLeft, y);
    doc.text(tx.desc, COL.descLeft, y, { width: 210, lineBreak: false });
    if (tx.debit  != null) rText(doc, fmtAmt(tx.debit),  COL.debitRight,  y);
    if (tx.credit != null) rText(doc, fmtAmt(tx.credit), COL.creditRight, y);
    if (tx.balance != null) rText(doc, fmtAmt(tx.balance), COL.balRight,  y);
    y += 17;
    if (y > 780) { doc.addPage(); y = 40; }
  }

  doc.end();
  return file;
}

// ─── Generate expected JSON ground-truth files ───────────────────────────────
// These are what textExtract.js should produce for each fixture.
// paymentType and payee are null (text layer doesn't infer them — only LLM does).

const expectedCurrent = {
  _fixture:    'layout-3col-current',
  colCount:    3,
  txCount:     TRANSACTIONS_CURRENT.filter(t => !t.isBalance).length,
  transactions: TRANSACTIONS_CURRENT
    .filter(t => !t.isBalance)
    .map((t, i) => ({
      id:          i + 1,
      date:        t.date,
      paymentType: null,
      description: t.desc,
      payee:       null,
      debit:       t.debit  != null ? +t.debit.toFixed(2)  : null,
      credit:      t.credit != null ? +t.credit.toFixed(2) : null,
      balance:     t.balance != null ? +t.balance.toFixed(2) : null,
    })),
};

const expectedCredit = {
  _fixture:    'layout-3col-credit',
  colCount:    3,
  txCount:     TRANSACTIONS_CREDIT.filter(t => !t.isBalance).length,
  transactions: TRANSACTIONS_CREDIT
    .filter(t => !t.isBalance)
    .map((t, i) => ({
      id:          i + 1,
      date:        t.date,
      paymentType: null,
      description: t.desc,
      payee:       null,
      debit:       t.debit  != null ? +t.debit.toFixed(2)  : null,
      credit:      t.credit != null ? +t.credit.toFixed(2) : null,
      balance:     t.balance != null ? +t.balance.toFixed(2) : null,
    })),
};

// ─── Run ─────────────────────────────────────────────────────────────────────
const f1 = buildCurrentPDF();
const f2 = buildCreditPDF();
fs.writeFileSync(path.join(EXPECTED_DIR, 'layout-3col-current.json'), JSON.stringify(expectedCurrent, null, 2));
fs.writeFileSync(path.join(EXPECTED_DIR, 'layout-3col-credit.json'),  JSON.stringify(expectedCredit,  null, 2));

console.log('Generated:');
console.log(' ', f1);
console.log(' ', f2);
console.log('  expected/layout-3col-current.json');
console.log('  expected/layout-3col-credit.json');
console.log('Run `node run.js` to test extraction against these fixtures.');
