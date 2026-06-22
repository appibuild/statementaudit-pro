# Decision Record — Standalone Trigger Fired (Side-by-Side PDF Audit)

**Date:** 22 June 2026
**Status:** Recommended — awaiting Stephen's confirmation. If accepted, anchors the next build phase.
**For:** Append to `STATEMENT_AUDIT_PROJECT_INSTRUCTIONS.md` (Strategic Decisions) and carry to the top of the next dated handover. Companion to `DECISION_RECORD_2026-06-12_1538_artifact-vs-standalone.md`.

---

## Decision (proposed)

One of the two triggers defined on 12 June has now fired. The 06-12 record said StatementAudit Pro moves from artifact to standalone the moment **either** "the next feature requires persistence" **or** "the product is going in front of a paying bookkeeper." A third, equivalent case has surfaced and should be treated the same way:

> **A feature with a real, evidenced need now exists that the artifact sandbox structurally cannot deliver — inline, side-by-side PDF display during human review.**

Recommendation: **scope and begin the standalone build (Node/Express proxy + static React frontend, in Claude Code) as the next phase**, while completing one last in-artifact feature first (the direction fix — see handover Job 3, which the sandbox *can* deliver).

## Why this is a genuine trigger, not a preference (the evidence)

This session proved a recurring extraction fault — transaction **direction** (money in vs money out) being read from the payment-type code instead of the printed column. The agreed safe workflow for the fix is **flag-and-correct**: the app suggests a correction, and the human auditor confirms it against the source statement. That workflow is only honest if the auditor can actually *see* the source while reviewing the flag — otherwise a flag they can't verify becomes a flag they learn to rubber-stamp, which silently defeats the human gate (the product's headline differentiator).

The live app **already has** the side-by-side feature coded: the `Show PDF` button toggles a right-hand pane intended to display the statement beside the grid. But in the artifact it fails with **"Can't show the PDF inline here. Open it in a new tab"** — confirmed live this session (screenshots 2026-06-22). The "new tab" fallback routes through a file download and opens the PDF *on top of*, not beside, the audit grid.

So the constraint is structural, not a scope choice:
- **CERTAIN:** the artifact sandbox blocks inline PDF embedding. The side-by-side layout exists in code but cannot render in-artifact. This is the "PDF side-by-side compare" item already logged in the project docs as a *standalone-era* item — now with a concrete, evidenced need attached.
- **CERTAIN:** the in-tab fallback materially harms the audit workflow (alt-tabbing between flag and source), which is exactly the friction that erodes review discipline.

Per the 06-12 logic, a wall that blocks a needed feature is the signal to move. The wall is now real and evidenced.

## What standalone Phase 1 actually entails (so the move is scoped, not vague)

From the existing roadmap and rebuild brief, Phase 1 of the standalone is a known shape:
- **Frontend:** port the existing single React component largely as-is (it is a near-complete UI). Add the real side-by-side: a PDF.js viewer pane beside the grid.
- **Backend:** Node/Express proxy holding the Anthropic API key server-side (no key in client code). Same server later handles OAuth2 for direct QBO/Xero push.
- **Storage:** default none (stateless, in-memory per session) to keep the privacy claim honest.
- **Build environment:** Claude Code, directly against the canonical repo — not the artifact.

What standalone unlocks beyond the PDF viewer (all currently blocked in-artifact): the verifiable zero-storage privacy claim (Ogilvy), a public rankable URL for the content GTM (Cheng), persistence for the payee cache / bank rules, and direct API push to QBO (the route to pre-coded QuickBooks). These were always the standalone's reasons to exist; the PDF viewer is simply the first that has become *blocking*.

## Board of Advisers — advice on record (22 June 2026)

| Adviser | Position | Core reasoning |
|---|---|---|
| Jason Fried | Move (no half-measures) | Don't fight the sandbox with a workaround. Inline PDF can't be forced into the artifact — accept the in-tab compromise for *your* validation, but for a real workflow, move. The trigger fired; act on it. |
| UK Practice Manager | Move for production | A PDF in a separate tab breeds skip-the-review habits — the one thing the gate must prevent. Tolerable for validation, unacceptable for client work. Needs side-by-side, which means standalone. |
| Amy Hoy | Move (after the in-artifact fix) | The direction fault hits *current accounts* — the most common type. Fixing it is non-negotiable; the verification UX that makes the fix trustworthy needs standalone. |
| Paul Jarvis | Move (sequenced) | The privacy headline and the side-by-side audit view are both standalone properties. Two core things now point the same way — that's a pattern, not a coincidence. Sequence the move; don't run both tracks. |
| David Ogilvy | Move | "See the suggestion next to the source" is a far stronger story than "trust our AI" — and, like the privacy claim, only fully credible on owned infrastructure. |
| Angus Cheng | Move (the clock is running) | The GTM/SEO window (incl. Guernsey GST 2028) is finite and needs a public URL the artifact can't provide. No objection to one last in-artifact fix; resist further in-artifact polish after it. |

**Consensus:** unanimous that the standalone move is now warranted; the only sequencing note is "finish the direction fix in-artifact first, since the sandbox can deliver it."

## Conflicts / risks flagged (not silently reconciled)

1. **"Validate first" vs the trigger now firing.** The patient-validation stance (Cheng/Fried/Jarvis, 06-12) has not changed; what changed is that a blocking wall appeared with evidence behind it. This is precisely the condition the 06-12 record built the trigger to catch, so it is consistent, not a reversal.
2. **Scope risk on the move.** Standalone Phase 1 must stay minimal: port the UI, add the proxy, add the PDF viewer. It must NOT become "rebuild everything / add Sage / add semantic categorisation at the same time." Those remain separately gated.
3. **Comfortable-trap, inverted.** The earlier risk was lingering in the artifact too long. The mirror risk now is rushing the move and dropping the proven in-artifact fix the customer needs *today*. Mitigation: ship the direction fix in-artifact first (it works there), then move.

## Mitigation on record

- Complete the in-artifact direction fix (handover Job 3) before standalone work begins — the sandbox can deliver it, and it protects the data quality that the whole product rests on.
- Treat standalone Phase 1 as strictly: UI port + Node/Express proxy + PDF.js side-by-side viewer + stateless default. No new features bundled into the move.
- Re-confirm the privacy guarantee wording at standalone launch (it becomes fully credible only then).

---

*This record is subject to Guardrail G3: if a future handover supersedes it, update in the same session and note it.*
