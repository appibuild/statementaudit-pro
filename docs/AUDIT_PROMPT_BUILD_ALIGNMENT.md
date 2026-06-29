# StatementAudit Pro — Build-Alignment & Reliability Audit Prompt

**Last updated:** 2026-06-29
**Type:** Canonical singleton (stable filename; update in place, never date-stamp).
**Purpose:** A reusable prompt to run a read-only audit of the live build against the
project non-negotiables and to hunt for silent-degradation risks. Phase 1 reports;
fixes are a separate, scope-confirmed Phase 2.

**How to use:** Paste the block below into Claude Code at the start of an audit session.
Before pasting, confirm the two anchors in the prompt are current — the build commit and
the source line count — against the latest handover and `VERSION`. Update them here if they
have moved.

**Model-pin status (resolved 2026-06-29):** `claude-sonnet-4-6` is confirmed in both
`verify.sh` and `GUARDRAILS.md`. The old `claude-sonnet-4-20250514` string was a
two-channel artefact; it no longer exists in any live document. No conflict to resolve.

---

```
StatementAudit Pro — build-alignment & reliability audit.

Context: single channel — you (Claude Code) and the git repo are the source of truth. Latest build is commit ccf44ec (2026-06-29, 7-feature build). Load docs/STATEMENTAUDIT_HANDOVER_2026-06-28_TRANSACTION-MODE-EXPANSION.md (two-pathway non-negotiables), docs/STATEMENTAUDIT_HANDOVER_2026-06-29_7FEATURES.md (today's feature record), and the live src/statement-audit-pro.jsx. This is an AUDIT, not a build. Phase 1 is read-only — review and report, do NOT edit, save, or commit. Implement fixes only in Phase 2, after I confirm scope.

PHASE 1 — AUDIT AND REPORT

1. Run `bash verify.sh` and paste the result. If it does not print ALL CHECKS PASSED, stop, reconcile src/statement-audit-pro.jsx against the live build, and report the drift first (G1). Confirm the file is canonical (line count matches VERSION — expected 4799).

2. Alignment check — original non-negotiables (the ones verify.sh fingerprints). For each, confirm it is present AND wired into a live code path that actually runs — not present-but-dead. Name the function/line and what reaches it:
   - Human approval gate is the ONLY path to any CSV export — every export handler is gated; no auto-post, bulk-approve, or bypass (including Pathway 2 / exportP2).
   - Model transcribes; deterministic code does ALL arithmetic — no model-side totals, reconciliation, or opening.
   - Two-anchor opening (trueOpeningFromTop / derivedOpening / openingAnchorsAgree), balanceBreaks integrity walk, CR/credit-marked balance rule, findFlip — each present and reachable.
   - Financial precision: +parseFloat(n).toFixed(2); no raw float arithmetic on currency.
   - Foreign-tx rule (never drop "@" / "Visa Rate"); UTF-8 BOM (﻿); DD/MM/YYYY in display, prompts, CSV body; robust indexOf/lastIndexOf JSON extractor; no assistant prefill; max_tokens 32000.
   - One general rule per account type — no per-bank prompt zoo.
   - Model pin: confirm the string in the live source, the string verify.sh greps for, and the string in GUARDRAILS.md all say `claude-sonnet-4-6`. If any disagree, name it (G5).

3. Alignment check — Pathway 2 non-negotiables (G6, 2026-06-28). NOT checked by verify.sh — review each by hand:
   - Per-line coding confirmation is a gate: each code is a proposal the user confirms or corrects, never auto-applied as fact. No friction switch (auto-confirm remembered payees, bulk-confirm) can turn the gate off. The coding step sits IN FRONT OF the approval gate, not in place of it.
   - Pathway 2 Xero export is a single atomic precoded file — one file, one import. Confirm there is no two-push path.
   - Layer 1 coding source is deterministic lookup only — payee memory or imported chart. Never model-inferred at Layer 1, even when a chart is loaded.
   - Layer 2 suggestions (new) — confirm suggestions are proposals only: the purple ✦ badge pre-fills the code field but the human ✓ gate still fires. No auto-confirm path exists for suggestions.
   - Pathway 2 scoped to empty periods only (Xero) — the empty-period assertion checkbox is a hard gate, not a UI preference.
   - QBO Code & Reference is reference-only — confirm the exported _CODED_REF.csv does not imply QBO applies codes automatically.

4. Alignment check — new-feature seam guards (added 2026-06-29). Each is REASONED unless you can confirm by code reading:
   - UK VAT seam: `vatUK` rule-pack must NOT appear in `recalc`, the balance walk, reconciliation arithmetic, or BASE_PROMPT/PROMPTS. Confirm verify.sh seam guard range 98–170 covers the full BASE_PROMPT + PROMPTS block and contains zero hits for `gstJersey` or `gstTreatment`. Confirm `vatUK` itself appears nowhere in those lines.
   - FX reference-only: `l.fxRate` field must NOT be written to any exported CSV (`buildXeroPrecoded`, `buildQBO`, `buildXero`, `buildAuditWorkbook`) and must NOT appear in any arithmetic expression. Confirm.
   - Xero/QBO CoA token: access token from `/api/xero-token` and `/api/qbo-token` must NOT be written to localStorage, sessionStorage, or persisted React state. Confirm the OAuth callback useEffect uses it in a closure only.
   - `/api/suggest-codes` model: confirm it calls `claude-haiku-4-5-20251001` (the cheap model), not the main extraction model `claude-sonnet-4-6`.

5. Silent-degradation hunt — the named dangerous failure mode is a check that fails or switches off silently with nothing surfaced in the UI. List specifically:
   - Dead code or handlers wired to nothing.
   - Functions that can silently return null/no-op without surfacing it to the user.
   - Validation/integrity checks that silently deactivate when their inputs are absent — and whether the UI tells the user the check is inactive.
   - Any catch block that swallows an error without surfacing it.
   - Unguarded export or state-transition paths around either gate (approval, Pathway 2 coding-confirm, empty-period).
   - Layer 2 `/api/suggest-codes` fails silently (`.catch(() => {})`) — this is intentional (suggestions are optional); confirm it does not degrade the gate when it fails.
   - Known watch item: HSBC text-layer coverage gap (degrades to LLM-only) — is the degrade surfaced?
   - Xero/QBO OAuth callback: if token exchange fails, is the error surfaced to the user or silently dropped?

6. Structure-for-reliability — identify specific structural risks, not cosmetics: duplicated logic that can drift out of sync, a value computed two different ways, magic numbers, error paths that never reach the UI. Propose the smallest targeted fix for each. Do NOT propose a wholesale reformat of the single-file component.

7. Compile/static check — run the esbuild compile and any static checks; report the result.

REPORTING RULES
- "Compiles" / "verify.sh green" is NOT the bar for correctness. Be explicit about the boundary: you can confirm code compiles and fingerprints are present and reachable; you cannot drive the live app against real PDFs.
- Tag every finding VERIFIED LIVE (naming the exact check) or REASONED (unconfirmed) — the G7 habit. Separate CERTAIN from HYPOTHESIS and label each (G4).
- End with a LIVE-TEST CHECKLIST: what only Stephen can confirm by running real statements — e.g. the approval gate blocks a non-reconciling statement; a coded line stays a proposal until confirmed; the 💱 FX badge appears on foreign-currency transactions; Layer 2 suggestions appear for unknown payees; the empty-period gate fires for non-empty Xero periods; UK VAT treatments populate the precoded Xero CSV correctly.
- Name any code/doc conflict out loud: what conflicts, which is right, the smallest fix (G5). Never silently reconcile.

PHASE 2 — FIXES (only after I confirm)
One job at a time, minimum change, scope confirmed first. Confirm before any file save. Any change touching the approval gate or the Pathway 2 gates needs genuine board consultation. Close with a commit (clear message, live-check named in it), a VERSION update if the line count changed, and a short dated session note if the work spans sessions.
```

---

## Maintenance notes

- **Anchors to refresh before each use:** the build commit (`ccf44ec`) and the source line
  count (`4799`) in the prompt. If a newer handover supersedes these, update them here and
  bump the *Last updated* line (G3).
- **Model-pin line:** conflict resolved 2026-06-29. Item 2's MODEL PIN bullet is now a
  plain presence/agreement check — no conflict to resolve.
- **verify.sh coverage:** the Pathway 2 non-negotiables are enforced by code review only.
  The new seam guards (UK VAT, FX, token, suggest-codes model) are in section 4 above —
  enforced by code reading in the audit. If any later get added to `verify.sh`, move them
  from section 4 into section 2.
- **New-feature non-negotiables (section 4):** added 2026-06-29 covering vatUK seam, FX
  reference-only, OAuth token scope, and suggest-codes model. These mirror the pattern
  established by Module A (gstJersey seam).
