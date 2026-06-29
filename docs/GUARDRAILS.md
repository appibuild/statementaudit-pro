# StatementAudit Pro — Anti-Drift Guardrails

**Created:** 2026-06-17 · **Last updated:** 2026-06-29 (Module A: Jersey GST rule-pack; verify.sh check 13 seam guard) · **Status:** Active. Applies to every session from here.

**Why this exists:** A review traced the recurring pain to *drift* — and found it was several different kinds, not one. This document names each kind, its root cause, and the mechanical guardrail that prevents it. Board-reviewed (Fried, Hoy, Jarvis, Ogilvy, UK Practice Manager). G7 added 2026-06-23 after the 3B post-mortem. Single-channel transition recorded 2026-06-23. G6 expanded 2026-06-28 after Pathway 2 build (new safety-critical non-negotiables).

---

## The kinds of drift (diagnosis)

| # | Drift | What happened | Root cause |
|---|---|---|---|
| 1 | **Code drift** | Stored project copy sat at the original 1,110 lines while the live build grew to 1,524. | Saving the live build back to the project was a manual chore with nothing forcing it. |
| 2 | **Document drift** | The rebuild brief called the Lloyds balance "open" after it was resolved (06-16). | A summary was written from older context and shipped without reconciling against the two most recent handovers. |
| 3 | **Narrative drift** | "Loop of errors → switch to OpenAI." A real feeling (this is painful) attached to a wrong cause (the model). | The framing was nearly accepted before being checked against the evidence. |
| 4 | **Handover drift** | 3B described as "complete"/"matched" across several handovers. It had never fired on a single real statement. | A claim reasoned true on paper was written as fact in the handover and inherited as fact by Claude Code, which can't re-test it. (Added 06-23; cured by G7.) |

**The expensive one is #3.** A stale file costs minutes. Rebuilding around the wrong cause (a model swap that wouldn't have fixed anything and would have discarded working prompts) costs weeks. The guardrails below address all of these, but the diagnosis rule (G4) exists specifically to stop #3.

**#4 is the quiet one.** G4 stops bad reasoning *inside* a session; the handover is where an unverified claim can still cross into the other channel and become inherited fact. G7 closes that seam — and the single-channel transition (below) removes the seam itself.

---

## The guardrails

### G1 — Run the check before working (cures code drift)

At the start of every session: run **`bash verify.sh`** from the repo root and load the most recent dated handover + the expansion brief. If verify does not print ALL CHECKS PASSED, stop and reconcile against the live build before doing anything else. No exceptions, including "just a quick change."

**Current session startup sequence:**
```bash
cd statementaudit-pro
bash verify.sh                        # must be 13/13 green
```
Then load:
- `docs/STATEMENTAUDIT_HANDOVER_2026-06-28_TRANSACTION-MODE-EXPANSION.md` — expansion brief and non-negotiables
- `src/statement-audit-pro.jsx` — canonical source (currently 3858 lines, commit ae7a9eb)

> Note: `docs/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` was referenced in the original G1 but does not exist — it was a two-channel artefact. The handover trail above is the current source of truth.

### G2 — Save back and commit before closing (cures code drift at the source)

A session is not finished until the working code is in `src/` and committed (`git add -A && git commit`). If the line count changed, update `expected_lines:` in `VERSION` in the same commit. The chore that got skipped becomes the definition of "done."

### G3 — Reconcile documents against the latest handover before trusting them (cures document drift)

Before relying on any summary, brief, or instruction file, check it against the **most recent dated handover**. The handover trail is the primary record; summaries are secondary and may lag. When they conflict, the latest handover wins, and the summary gets corrected.

### G4 — Diagnose before prescribing; show the evidence (cures narrative drift)

Before proposing any significant change (a new tool, a provider switch, a rebuild, a big refactor), state the problem in one sentence and show the evidence for the *cause*, not just the symptom. Separate proof from guess: "what's wrong" can stand on arithmetic or a live check; "why it happened" needs evidence and is labelled a hypothesis until confirmed. A fix proposed without a named, evidenced cause is on hold until one exists.

### G5 — Name conflicts out loud (cures all kinds; standing request from Stephen)

When a conflict is found between any two sources, say so explicitly: what conflicts with what, which source is correct and why, and the smallest fix. Never silently reconcile in the background.

### G6 — Protect the safety-critical things loudest (UK Practice Manager's rule)

The checks that matter most are the ones guarding client data and trust. `verify.sh` checks the core fingerprints. A change that touches any item on either list below is flagged and confirmed before it lands — never as a side effect of another change.

**Original non-negotiables (checked by verify.sh):**
- Human approval gate — the only path to any CSV export; no auto-post, ever
- Reconciliation maths — deterministic arithmetic, no LLM arithmetic
- Foreign-transaction rule — present in the extraction prompt
- UTF-8 BOM on every CSV export
- Model pinned to `claude-sonnet-4-6`, `max_tokens: 32000`
- Robust `indexOf`/`lastIndexOf` JSON extractor — no assistant prefill

**Pathway 2 non-negotiables (added 2026-06-28 — not currently checked by verify.sh; enforce by code review):**
- **Per-line coding confirmation gate is safety-critical.** In Pathway 2, each code is a *proposal* the user confirms or corrects — never auto-applied as fact. Friction switches (auto-confirm remembered payees, bulk-confirm) may cut clicks but **no switch may turn the gate off**. A statement can still fail reconciliation after all lines are coded — the coding step sits *in front of* the approval gate, not in place of it.
- **Pathway 2 Xero export is a single atomic precoded file.** One file, one import. Never build a two-push approach (create transactions separately + import statement file, relying on them meeting inside Xero) — that causes match failures and doubles.
- **Coding source is deterministic lookup only.** Codes come from payee memory or an imported chart of accounts/items list. Coding is never model-inferred at Layer 1. The lookup stays deterministic even when a chart is loaded.
- **Pathway 2 scoped to empty periods only (Xero).** The empty-period assertion checkbox is a hard gate, not a UI preference. Precoded lines against a period that already has entries cause Xero duplicates and match failures. Never remove or soften this gate.
- **QBO Code & Reference is a reference guide, not a precoded import.** QBO's bank CSV import does not apply codes automatically. Do not build a mechanism that implies or claims it does. The exported `_CODED_REF.csv` is for manual reference only.

### G7 — Tag every handover claim with its evidence; "VERIFIED LIVE" must name the check (cures handover drift)

Every job or finding written into a handover carries a status tag: **`VERIFIED LIVE`** or **`REASONED (unconfirmed)`**.
- A claim earns `VERIFIED LIVE` only if it states **what** was confirmed and **how**, in the running app — e.g. *"3B verified live: forced a wrong-column row on the 15/04 statement, the one-click suggestion fired, accepting it reconciled to £1,474.89."* A bare "verified" does **not** qualify.
- An **untagged** claim is treated as **unconfirmed** by default.
- Tags are **per claim, not per job.**

**Why this exists:** the handover is the one place an unconfirmed claim can launder itself into a fact and cross to another channel that cannot re-test it. **Status under single channel (see below): the cross-channel seam is gone, so G7's original job is done — but the *habit it enforces stays*: never write "verified" without naming the live check. Keep the tags in commit messages and session notes; they cost nothing and keep the discipline honest.**

---

## Single-channel transition (2026-06-23)

**What changed.** The two-channel split (this-side-plans / Claude-Code-builds) existed for one reason only: the planning channel had no file-system access. At the standalone phase that limitation is gone — Claude Code can run, test, edit, commit, write records, and consult the board in one place. **Claude Code is now the single channel. The git repo is the single source of truth.**

**What retires.** The *cross-channel handover overhead* — elaborate bridge documents whose job was to carry facts safely across the seam. There is no seam now. G7's seam-crossing risk is therefore closed.

**What stays (do not drop these with the channel):**
- **Verify in the running app.** "Compiles" / "tests pass" is **not** the bar. Today's duplicate-viewer bug passed `verify.sh` while being unreachable in dead code — caught only by clicking the live app. The standalone MUST have a real way to run and click it (local dev run + a deployed URL), and correctness claims must rest on that, not on a successful build.
- **Separate proof from guess (G4)** and **name the live check** behind any "verified" (the G7 habit), now in commit messages and lightweight dated session notes rather than cross-channel handovers.
- **Genuine board consultation.** The board is eight personas defined in prior session records; consult the relevant ones on strategic decisions, **surface real disagreement, and don't let it become a rubber stamp** — if a "consultation" produces no tension, it wasn't really run.
- **Plan first, minimum change, confirm before any file save or delete.**

**Continuity in a single channel.** Replace cross-channel handovers with: clear commit messages, the existing dated decision records for real decisions, and a short dated session note when a session closes mid-stream. The repo + git history carry continuity; no bridge document is needed.

---

## Board feedback on record (2026-06-17)

- **Jason Fried:** Keep the guard mechanical, not a remembered ritual; don't gold-plate it. The real scope risk was the near-miss provider switch, not feature creep.
- **Amy Hoy:** The misdiagnosis was costlier than the stale file. Force a diagnosis-with-evidence step (G4) before any big fix.
- **Paul Jarvis:** A company-of-one must be able to sustain the guardrail alone, indefinitely. A shell script run once per session is sustainable; an unfamiliar git ritual is not. Tie guards to existing habits.
- **UK Practice Manager:** No drift may silently weaken the approval gate or the maths. The check must scream loudest about those (G6).
- **David Ogilvy:** Half the drift was language. Write each rule so a tired person reads it once and acts correctly.

**Tension resolved:** Fried (keep it minimal) vs the Practice Manager (check the safety-critical set, even if that's several things). Resolution: minimal in *form* (one mechanical check, run once), but the safety-critical non-negotiables all earn their place in it. No cosmetic checks. **Consistent with this: the Pathway 2 non-negotiables in G6 are not a new numbered guardrail — they are an extension of the existing G6 list. No gold-plating the structure.**

## G7 provenance (2026-06-23)

Added after the findFlip / 3B sign-bug post-mortem. Surfaced by Claude Code's own feedback: the failure mode wasn't the two-channel structure but handover quality — a paper claim crossing the channel boundary as inherited fact. Simon Willison's remit (extraction reliability, solo-dev maintainability). Consistent with Ogilvy's note: the tag is a one-glance signal a tired reader acts on correctly.

## Module A — Jersey GST seam (2026-06-29, commit ae7a9eb)

`gstJersey` rule-pack added. Seam rule: the rule-pack is consulted ONLY by (a) the coding modal GST column and (b) `buildXeroPrecoded`. It MUST NOT appear in `recalc`, the balance walk, reconciliation arithmetic, or `BASE_PROMPT`/`PROMPTS`. verify.sh check 13 enforces this — fails if `gstJersey` or `gstTreatment` appear in the extraction prompt block (lines 74–140). The engine is GST-agnostic: treatment is metadata on the transaction, never an arithmetic input.

**Rate-maintenance discipline:** the rule-pack carries `verifiedAt: '2026-06-29'`. `gstJersey.isExpired()` returns true after 365 days — the precoded export is hard-blocked when this fires. Stephen must update `verifiedAt` (and re-verify against Revenue Jersey) each year before the expiry. The rate/treatment data comes from Revenue Jersey / GST (Jersey) Law 2007, Schedules 5 & 6 — not Claude Code memory.

**QBO boundary preserved:** no GST treatment column in QBO modal (reference-only boundary unchanged).

## Tracking Categories + Workbook GST column (2026-06-29, commits 15c29ff + 426214f)

Two additions completing the Pathway 2 / Xero precoded export:

1. **GST Treatment in Audit Workbook** (`buildAuditWorkbook`): column 12 of Audit Review sheet now shows the confirmed Jersey GST treatment for each transaction on Xero statements. Treatment labels resolved from `treatmentMemory` via `normKey` at the `dlWorkbook` call site. Non-Xero statements: column present, always empty.

2. **Xero Tracking Categories**: `trackingCategories {source, loadedAt, cats}` state + `trackingMemory {normKey: {t1,t2}}`. Import from Xero Tracking Settings CSV export. Tracking sub-row per coding line (optional, not gated). `buildXeroPrecoded` now populates Tracking1/Tracking2 columns. The `source` field is the designed switch point — replace `importTrackingCSV` with a Xero API call and set `source:'api'` when OAuth is available; no other code changes needed.

**Non-negotiable unchanged:** tracking is optional (UK Practice Manager constraint). No gate on tracking values.

## M365 Workspace (2026-06-29)

Shared OneDrive workspace feature added. Key decisions that must not be silently reversed:

- **Microsoft OAuth scope is now `Files.ReadWrite`** (not `Files.ReadWrite.AppFolder`). AppFolder is user-isolated and cannot be shared. Files.ReadWrite allows creating a regular OneDrive folder that can be shared with colleagues. Any future scope change that reverts to AppFolder will break the workspace.
- **Workspace uses "Anyone with the link can edit" OneDrive shares.** The share URL is resolved via Microsoft Graph `v1.0/shares/{u!base64url(shareUrl)}/driveItem`. The admin creates the folder, gets the share URL from OneDrive, and distributes it to colleagues. The link must be "can edit" not "can view".
- **Personal BYOC (approot) and Workspace are mutually exclusive modes.** When a workspace is active, new approved statements save to the workspace folder; the personal approot is unused. Disconnecting from Microsoft clears both.
- **Workspace memory auto-pushes on every memory state change.** The `payeeMemory`, `categoryMemory`, `treatmentMemory`, `trackingMemory` useEffect calls `wsSaveFile` for `workspace_memory.json` when workspace is active. This is intentional — it keeps shared memory current after every export. Do not add a debounce or guard that skips small changes.
- **Phase 3 (login-per-user, Postgres, per-user audit logs) remains parked.** This workspace feature is NOT Phase 3 and does not open the Phase 3 compliance gate. It uses the practice's existing M365 DPA. StatementAudit Pro is a connector, not a data store.

## P2-F1 resolved (2026-06-28, post-audit)

The build-alignment audit found that the Export tab had "↓ Pre-coded" (per-statement) and "↓ Merged Xero (pre-coded)" buttons that called `buildXeroPrecoded` directly, bypassing both the per-line coding confirmation modal and the empty-period assertion. Board + user panel review: unanimous removal. Both buttons have been deleted. The only route to a precoded export is now through the Code & Create modal. Recorded here so future sessions don't re-introduce a convenience shortcut to this path.

## G6 Pathway 2 extension provenance (2026-06-28)

Added after completing the two-pathway build (commit `612b251`). The expansion brief (`STATEMENTAUDIT_HANDOVER_2026-06-28_TRANSACTION-MODE-EXPANSION.md`, §7) carried five non-negotiables specific to Pathway 2 that were not represented in the original G6 list. The most failure-prone are the two-push anti-pattern (single atomic import), the coding gate (friction switches must never disable it), and the QBO reference-only boundary. These are named explicitly so a future session can't silently drift them.

---

*These guardrails are themselves subject to G3: if a future handover or decision record supersedes one, update this file in the same session and note it in the changelog line.*
