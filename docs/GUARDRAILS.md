# StatementAudit Pro — Anti-Drift Guardrails

**Created:** 2026-06-17 · **Last updated:** 2026-06-23 (added G7; single-channel transition note) · **Status:** Active. Applies to every session from here.
**Why this exists:** A review traced the recurring pain to *drift* — and found it was several different kinds, not one. This document names each kind, its root cause, and the mechanical guardrail that prevents it. Board-reviewed (Fried, Hoy, Jarvis, Ogilvy, UK Practice Manager). G7 added 2026-06-23 after the 3B post-mortem. Single-channel transition recorded 2026-06-23 (see end).

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
At the start of every session: **read `docs/STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md`** (the durable rules and the eight-member board) and run **`bash verify.sh`**. If verify does not print ALL CHECKS PASSED, stop and reconcile against the live build before doing anything else. No exceptions, including "just a quick change." The instructions-read matters most now that this is a **single channel**: if a long session compresses context, re-read this file before any strategic decision or board consultation rather than relying on memory.

### G2 — Save back and commit before closing (cures code drift at the source)
A session is not finished until the working code is in `src/` and committed (`git add -A && git commit`). If the line count changed, update `expected_lines:` in `VERSION` in the same commit. The chore that got skipped becomes the definition of "done."

### G3 — Reconcile documents against the latest handover before trusting them (cures document drift)
Before relying on any summary, brief, or instruction file, check it against the **most recent dated handover**. The handover trail is the primary record; summaries are secondary and may lag. When they conflict, the latest handover wins, and the summary gets corrected.

### G4 — Diagnose before prescribing; show the evidence (cures narrative drift)
Before proposing any significant change (a new tool, a provider switch, a rebuild, a big refactor), state the problem in one sentence and show the evidence for the *cause*, not just the symptom. Separate proof from guess: "what's wrong" can stand on arithmetic or a live check; "why it happened" needs evidence and is labelled a hypothesis until confirmed. A fix proposed without a named, evidenced cause is on hold until one exists.

### G5 — Name conflicts out loud (cures all kinds; standing request from Stephen)
When a conflict is found between any two sources, say so explicitly: what conflicts with what, which source is correct and why, and the smallest fix. Never silently reconcile in the background.

### G6 — Protect the safety-critical things loudest (UK Practice Manager's rule)
The checks that matter most are the ones guarding client data and trust: the mandatory human approval gate, the reconciliation maths, the foreign-transaction rule, the BOM, the pinned model. `verify.sh` checks these by fingerprint. A change that touches any of them is flagged and confirmed before it lands — never as a side effect of another change. **These checks must travel into the standalone build** (a `verify.sh` equivalent guarding the same fingerprints).

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
- **Genuine board consultation.** The board is eight personas defined in `PROJECT_INSTRUCTIONS.md`; consult the relevant ones on strategic decisions, **surface real disagreement, and don't let it become a rubber stamp** — if a "consultation" produces no tension, it wasn't really run.
- **Plan first, minimum change, confirm before any file save or delete.**

**Continuity in a single channel.** Replace cross-channel handovers with: clear commit messages, the existing dated decision records for real decisions, and a short dated session note when a session closes mid-stream. The repo + git history carry continuity; no bridge document is needed.

---

## Board feedback on record (2026-06-17)

- **Jason Fried:** Keep the guard mechanical, not a remembered ritual; don't gold-plate it. The real scope risk was the near-miss provider switch, not feature creep.
- **Amy Hoy:** The misdiagnosis was costlier than the stale file. Force a diagnosis-with-evidence step (G4) before any big fix.
- **Paul Jarvis:** A company-of-one must be able to sustain the guardrail alone, indefinitely. A shell script run once per session is sustainable; an unfamiliar git ritual is not. Tie guards to existing habits.
- **UK Practice Manager:** No drift may silently weaken the approval gate or the maths. The check must scream loudest about those (G6).
- **David Ogilvy:** Half the drift was language. Write each rule so a tired person reads it once and acts correctly.

**Tension resolved:** Fried (keep it minimal) vs the Practice Manager (check the safety-critical set, even if that's several things). Resolution: minimal in *form* (one mechanical check, run once), but the safety-critical non-negotiables all earn their place in it. No cosmetic checks. **Consistent with this: no new numbered guardrail was added for the single-channel move or the "compiles ≠ reachable" lesson — both are folded into existing rules rather than gold-plating the list.**

## G7 provenance (2026-06-23)

Added after the findFlip / 3B sign-bug post-mortem. Surfaced by Claude Code's own feedback: the failure mode wasn't the two-channel structure but handover quality — a paper claim crossing the channel boundary as inherited fact. Simon Willison's remit (extraction reliability, solo-dev maintainability). Consistent with Ogilvy's note: the tag is a one-glance signal a tired reader acts on correctly.

---

*These guardrails are themselves subject to G3: if a future handover or decision record supersedes one, update this file in the same session and note it in the changelog line.*
