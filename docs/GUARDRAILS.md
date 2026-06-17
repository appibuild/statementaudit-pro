# StatementAudit Pro — Anti-Drift Guardrails

**Created:** 2026-06-17 · **Status:** Active. Applies to every session from here.
**Why this exists:** A review traced the recurring pain to *drift* — and found it was three different kinds, not one. This document names each kind, its root cause, and the mechanical guardrail that prevents it. Board-reviewed (Fried, Hoy, Jarvis, Ogilvy, UK Practice Manager).

---

## The three kinds of drift (diagnosis)

| # | Drift | What happened | Root cause |
|---|---|---|---|
| 1 | **Code drift** | Stored project copy sat at the original 1,110 lines while the live build grew to 1,524. | Saving the live build back to the project was a manual chore with nothing forcing it. |
| 2 | **Document drift** | The rebuild brief called the Lloyds balance "open" after it was resolved (06-16). | A summary was written from older context and shipped without reconciling against the two most recent handovers. |
| 3 | **Narrative drift** | "Loop of errors → switch to OpenAI." A real feeling (this is painful) attached to a wrong cause (the model). | The framing was nearly accepted before being checked against the evidence. |

**The expensive one is #3.** A stale file costs minutes. Rebuilding around the wrong cause (a model swap that wouldn't have fixed anything and would have discarded working prompts) costs weeks. The guardrails below address all three, but the diagnosis rule (G4) exists specifically to stop #3.

---

## The guardrails

### G1 — Run the check before working (cures code drift)
At the start of every session: `bash verify.sh`. If it does not print ALL CHECKS PASSED, stop and reconcile the file against the live artifact before doing anything else. No exceptions, including "just a quick change."

### G2 — Save back and commit before closing (cures code drift at the source)
A session is not finished until the working code is in `src/` and committed (`git add -A && git commit`). If the line count changed, update `expected_lines:` in `VERSION` in the same commit. The chore that got skipped becomes the definition of "done."

### G3 — Reconcile documents against the latest handover before trusting them (cures document drift)
Before relying on any summary, brief, or instruction file, check it against the **most recent dated handover**. The handover trail is the primary record; summaries are secondary and may lag. When they conflict, the latest handover wins, and the summary gets corrected.

### G4 — Diagnose before prescribing; show the evidence (cures narrative drift)
Before proposing any significant change (a new tool, a provider switch, a rebuild, a big refactor), state the problem in one sentence and show the evidence for the *cause*, not just the symptom. Separate proof from guess: "what's wrong" can stand on arithmetic or a live check; "why it happened" needs evidence and is labelled a hypothesis until confirmed. A fix proposed without a named, evidenced cause is on hold until one exists.

### G5 — Name conflicts out loud (cures all three; standing request from Stephen)
When a conflict is found between any two sources, say so explicitly: what conflicts with what, which source is correct and why, and the smallest fix. Never silently reconcile in the background.

### G6 — Protect the safety-critical things loudest (UK Practice Manager's rule)
The checks that matter most are the ones guarding client data and trust: the mandatory human approval gate, the reconciliation maths, the foreign-transaction rule, the BOM, the pinned model. `verify.sh` checks these by fingerprint. A change that touches any of them is flagged and confirmed before it lands — never as a side effect of another change.

---

## Board feedback on record (2026-06-17)

- **Jason Fried:** Keep the guard mechanical, not a remembered ritual; don't gold-plate it. The real scope risk was the near-miss provider switch, not feature creep.
- **Amy Hoy:** The misdiagnosis was costlier than the stale file. Force a diagnosis-with-evidence step (G4) before any big fix.
- **Paul Jarvis:** A company-of-one must be able to sustain the guardrail alone, indefinitely. A shell script run once per session is sustainable; an unfamiliar git ritual is not. Tie guards to existing habits.
- **UK Practice Manager:** No drift may silently weaken the approval gate or the maths. The check must scream loudest about those (G6).
- **David Ogilvy:** Half the drift was language. Write each rule so a tired person reads it once and acts correctly.

**Tension resolved:** Fried (keep it minimal) vs the Practice Manager (check the safety-critical set, even if that's several things). Resolution: minimal in *form* (one mechanical check, run once), but the safety-critical non-negotiables all earn their place in it. No cosmetic checks.

---

*These guardrails are themselves subject to G3: if a future handover supersedes one, update this file in the same session and note it in the changelog line.*
