#!/usr/bin/env bash
# verify.sh — run at the START of every session, before any editing.
# This is the cure for the stale-file trap. It checks the actual source file
# against the non-negotiables recorded in VERSION. If anything has drifted,
# it fails loudly so you fix the inputs before you build on a stale base.

set -u
SRC="src/statement-audit-pro.jsx"
FAIL=0

red()  { printf "\033[31m%s\033[0m\n" "$1"; }
grn()  { printf "\033[32m%s\033[0m\n" "$1"; }
yel()  { printf "\033[33m%s\033[0m\n" "$1"; }

echo "── StatementAudit Pro — source-of-truth check ──"

# 1. line count vs VERSION
EXPECTED=$(grep '^expected_lines:' VERSION | awk '{print $2}')
ACTUAL=$(wc -l < "$SRC" | tr -d ' ')
if [ "$EXPECTED" = "$ACTUAL" ]; then
  grn "✓ line count $ACTUAL matches VERSION ($EXPECTED)"
else
  red "✗ line count $ACTUAL ≠ VERSION ($EXPECTED) — STALE FILE. Reconcile before editing."
  FAIL=1
fi

# 2. pinned model
if grep -q "claude-sonnet-4-20250514" "$SRC"; then
  grn "✓ model pinned to claude-sonnet-4-20250514"
else
  red "✗ pinned model string missing or changed"
  FAIL=1
fi

# 3. token budget
if grep -q "max_tokens:32000\|max_tokens: 32000" "$SRC"; then
  grn "✓ max_tokens: 32000"
else
  red "✗ max_tokens is not 32000 (truncation risk on large statements)"
  FAIL=1
fi

# 4. robust JSON extractor present, no prefill
if grep -q "indexOf('{')" "$SRC" && grep -q "lastIndexOf('}')" "$SRC"; then
  grn "✓ robust JSON extractor present"
else
  red "✗ robust indexOf/lastIndexOf extractor missing"
  FAIL=1
fi
if grep -q "role:'assistant', content:'{'\|role: 'assistant', content: '{'" "$SRC"; then
  red "✗ assistant prefill reintroduced — the pinned model rejects it. Remove."
  FAIL=1
else
  grn "✓ no assistant prefill"
fi

# 5. resolved-work fingerprints (must still be present)
for token in "trueOpeningFromTop" "openingAnchorsAgree" "balanceBreaks" "credit-marked balance"; do
  if grep -q "$token" "$SRC"; then
    grn "✓ resolved-work present: $token"
  else
    yel "⚠ expected resolved-work marker not found: $token (was it removed?)"
    FAIL=1
  fi
done

# 6. human gate + foreign-tx + BOM non-negotiables
grep -q "Visa Rate" "$SRC" && grn "✓ foreign-transaction rule present" || { red "✗ foreign-transaction rule missing"; FAIL=1; }
grep -q "uFEFF" "$SRC" && grn "✓ UTF-8 BOM on export" || { red "✗ UTF-8 BOM missing"; FAIL=1; }

echo "────────────────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  grn "ALL CHECKS PASSED — this is the canonical build. Safe to work."
  exit 0
else
  red "CHECKS FAILED — do NOT build on this file until reconciled with the live artifact."
  exit 1
fi
