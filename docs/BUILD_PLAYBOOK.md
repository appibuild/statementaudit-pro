# Build Playbook — portable lessons for any app build

**Last updated:** 2026-06-29
**What this is:** the transferable lessons, not the project specifics. One principle per line. Replace this file, never append; keep it short. Update at session-end alongside the handover. Project-only rules live in that project's GUARDRAILS / instructions and just point here.

---

## Architecture — when an AI model is in the pipeline

- The model reads; deterministic code does the arithmetic. Never let the model do sums on money or other critical figures.
- Check the model against an **independent** source of truth, never against its own computed numbers — a number can't catch its own mistake.
- Treat every AI extraction field as *probably-sometimes-missing*. Design for the field being absent, don't assume it's present.
- Transcribe, don't compute, when an authoritative figure is printed (capture what the source shows). Compute only as a clearly-labelled human aid, never as an auto-check input.
- One general rule per category, not a per-case rule library. A per-case "zoo" creates conflicts and is unmaintainable for a solo dev.

## Failure handling — the expensive lessons

- **Make silent failure loud.** If a check can't run (missing input, degraded mode), say so on screen. Silent graceful degradation hides the fact that your best tool is switched off — and you'll debug by hand for hours not knowing.
- A safeguard must guarantee the **outcome**, not just an **action**. "A human clicked" is not "the thing is correct." Gate on the result.
- A safeguard must never be a dead-end. Always leave a way to fix or back out.
- Don't build an override/escape-hatch for a problem you haven't actually seen. Add it only when a real case demands it.

## Verification — proof, not vibes

- Verify in the running app, not the compiler. "It compiles / it should work" is not done.
- Verify the assumption against **real data**, not the architecture. "Wired to capture X" ≠ "X is being captured." Check the actual output.
- Separate proof from guess. State a cause as fact only when proven by arithmetic or seen live. A plausible story from a screenshot is a guess — label it, give a confidence level, lead with the check that would confirm it.
- Evidence before fixes. Confirm the cause (e.g. capture one raw model response and look) before changing anything.
- When two sources disagree, name the conflict out loud — what conflicts, which is right, why, smallest fix. Never silently reconcile.

## Scope & change discipline

- Minimum change. Don't refactor or expand beyond the task.
- Diagnose before prescribing. State the problem in one sentence and show the evidence before any big change.
- Touch the most-protected areas (the gate, the money math, the prompt) only deliberately — never as a side effect. Keep a machine-checked list of non-negotiables (a `verify.sh` of fingerprints) and confirm it stays green on every change.
- Highest-value, broadest-protection job first; smarter-but-narrower jobs after.

## Working method — single channel & anti-drift

- The repo folder is the single source of truth. Never work from a pasted copy — point Claude Code at the file on disk.
- When using a two-channel setup (planning chat + Claude Code), they never touch the same file at once, and a dated handover is the shared memory between them. Single-channel (Claude Code only) is the simpler default when the tool has full file access.
- Open every session by checking the live build against the last handover (run the fingerprint check). Reconcile before planning.
- Close every session with a commit and a dated handover. (Skipping this is what makes the next session start messy — proven the hard way.)
- Canonical files (code, instructions, this playbook): stable name, internal "Last updated" line, replaced not timestamped. Dated files (handovers, decision records): kept, never overwritten. Rule of thumb: date in filename → keep; no date → replace.
- Advise and confirm before any file save or delete. Never act on files silently.

## Communication

- Plain, everyday language as if to a non-technical reader: lead with the point, short sentences, cut jargon. Brief over thorough.

## Data & privacy

- Never persist real personal data. Treat it as session-only working data.
- Test data: synthetic with known ground truth, your own or consenting parties', or deliberately-public sources. Never scraped repositories of real individuals' documents.

---

*Maintenance: review at each session-end; fold in any new portable lesson as a single concise line; remove duplicates; bump Last updated.*
