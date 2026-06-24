'use strict';
// Regression test runner for the text-layer extractor against synthetic fixtures.
// PASS = extraction matches ground truth within tolerance.
// FAIL = structural mismatch (wrong count, wrong amounts, wrong dates).
//
// Run: node run.js
// All fixtures in ./fixtures/ are tested against ./expected/<name>.json.
// Synthetic and real test sets are in separate directories — this runner never
// touches tests/real/ and makes no accuracy claims about real statements.

const fs   = require('fs');
const path = require('path');

const { detectAndExtract } = require('../../server/textExtract.js');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const EXPECTED_DIR = path.join(__dirname, 'expected');

const AMT_TOL = 0.015; // same tolerance used in crossCheck.js

function close(a, b) { return Math.abs((a ?? 0) - (b ?? 0)) <= AMT_TOL; }

async function runFixture(pdfFile, expectedFile) {
  const name = path.basename(pdfFile, '.pdf');
  const base64 = fs.readFileSync(pdfFile).toString('base64');
  const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf8'));

  let result;
  try {
    result = await detectAndExtract(base64);
  } catch (err) {
    return { name, pass: false, error: err.message };
  }

  if (!result) {
    return { name, pass: false, error: 'detectAndExtract returned null — text layer not detected' };
  }

  const errors = [];

  // Column count
  if (result.colCount !== expected.colCount) {
    errors.push(`colCount: expected ${expected.colCount}, got ${result.colCount}`);
  }

  // Transaction count
  const gotCount = result.transactions.length;
  if (gotCount !== expected.txCount) {
    errors.push(`txCount: expected ${expected.txCount}, got ${gotCount}`);
  }

  // Per-transaction checks (only as many as both sides have)
  const pairs = Math.min(gotCount, expected.transactions.length);
  for (let i = 0; i < pairs; i++) {
    const g = result.transactions[i];
    const e = expected.transactions[i];
    const prefix = `tx[${i}] (${e.date})`;

    if (g.date !== e.date) {
      errors.push(`${prefix} date: expected ${e.date}, got ${g.date}`);
    }
    if (!close(g.debit, e.debit)) {
      errors.push(`${prefix} debit: expected ${e.debit ?? 'null'}, got ${g.debit ?? 'null'}`);
    }
    if (!close(g.credit, e.credit)) {
      errors.push(`${prefix} credit: expected ${e.credit ?? 'null'}, got ${g.credit ?? 'null'}`);
    }
    if (e.balance != null && g.balance != null && !close(g.balance, e.balance)) {
      errors.push(`${prefix} balance: expected ${e.balance}, got ${g.balance}`);
    }
  }

  return { name, pass: errors.length === 0, errors };
}

async function main() {
  const pdfs = fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(FIXTURES_DIR, f));

  if (!pdfs.length) {
    console.error('No fixture PDFs found. Run `node generate.js` first.');
    process.exit(1);
  }

  console.log('── StatementAudit Pro — Synthetic fixture tests ──');
  let passed = 0, failed = 0;

  for (const pdfFile of pdfs) {
    const name         = path.basename(pdfFile, '.pdf');
    const expectedFile = path.join(EXPECTED_DIR, `${name}.json`);
    if (!fs.existsSync(expectedFile)) {
      console.log(`  SKIP  ${name} — no expected JSON`);
      continue;
    }
    const result = await runFixture(pdfFile, expectedFile);
    if (result.pass) {
      console.log(`  PASS  ${result.name}`);
      passed++;
    } else {
      console.log(`  FAIL  ${result.name}`);
      if (result.error) console.log(`        error: ${result.error}`);
      (result.errors || []).forEach(e => console.log(`        • ${e}`));
      failed++;
    }
  }

  console.log('──────────────────────────────────────────────────');
  console.log(`  ${passed} passed  ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
