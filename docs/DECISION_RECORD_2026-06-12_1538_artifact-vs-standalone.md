# Decision Record — Form Factor: Artifact vs Standalone

**Date:** 12 June 2026
**Status:** Decided. Anchors the build sequence.
**For:** Append to `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` (Strategic Decisions) and carry to the top of the next dated handover.

---

## Decision

**Artifact validates, standalone commercialises.** StatementAudit Pro stays a Claude.ai
artifact for validation only. It moves to a standalone build (Node/Express proxy + static
React frontend) — **built in Claude Code, not the artifact** — the moment either trigger fires,
whichever comes first:

1. The next feature requires persistence (bank rules engine / `payee_rules.json` payee cache), **or**
2. The product is going in front of a paying bookkeeper.

Before that trigger, going standalone is premature infrastructure. After it, staying in the
artifact is a hard commercial ceiling. The trigger is the exact point at which Claude Code
becomes the correct build environment.

## Why the artifact cannot be the product

Every mechanism that actually beats DocuClipper is structurally impossible in-artifact:
persistent bank rules, the payee cache, direct QBO/Xero API push, multi-user practice
workspaces, a public URL for the content-marketing GTM, a verifiable zero-storage privacy
pipeline, and billing. The artifact is the validation lab; the standalone is the business.

## Build sequence implied by this decision

- **In artifact (now):** Confidence Threshold System → stateless half of semantic categorisation.
- **Trigger flips to standalone (Claude Code):** bank rules + payee cache (Phase 1 backend proxy),
  then direct API push (Phase 2), then multi-user (Phase 3).

---

## Board of Advisers — Advice on Record (12 June 2026)

| Adviser | Position | Core reasoning |
|---|---|---|
| Angus Cheng | Standalone (after validation) | Content-marketing GTM needs a public, rankable URL anyone can land on and use. Artifacts can't rank or be reached without a Claude.ai account. Prove features in the artifact first; don't fiddle. |
| Amy Hoy | Standalone (after validation) | The customer is a non-developer bookkeeper who doesn't live in Claude. An artifact serves an imagined customer. Validate cheaply, then build the real app. |
| UK Practice Manager | Standalone for production | Won't run client work in a chatbot; needs login, persistence, a DPA. Bank rules + payee cache (her biggest time-saver) are impossible without localStorage/storage. Happy with an artifact demo during validation. |
| Jason Fried | Artifact until a feature needs persistence | Don't build a backend before there's something worth deploying. But the moment a feature needs persistence or login, the artifact is a dead end — move, no half-measures. |
| David Ogilvy | Standalone | The privacy claim ("your data is never stored") describes a server you control. In-artifact the pipeline runs through Claude.ai — harder to publish a security page or stand behind a DPA. Standalone makes the best headline credible. |
| Paul Jarvis | Standalone (sequenced) | Artifact = lab; standalone = product. A company-of-one needs something ownable, billable, durable. Sequence the move; don't run both tracks at once. |

**Consensus:** unanimous that standalone is required to commercialise; difference is only on *timing*.

---

## Conflicts with project goals (flagged, not resolved)

1. **"Validate first" vs privacy-as-differentiator.** Privacy/zero-storage is a stated core
   marketing pillar, but Ogilvy's point is that the claim is only *fully* credible on
   infrastructure we control. The longer we sit in the artifact, the longer our strongest
   headline is harder to substantiate. The patient-validation advice (Cheng/Fried/Jarvis)
   is in tension with a pillar that wants standalone sooner.

2. **Scope-cutting vs unified-pipeline narrative.** Fried/Jarvis would cut aggressively
   (challenge Excel, audit log, bank rules before Confidence is proven). Cut too far and the
   "one tool replaces two subscriptions / beats DocuClipper on depth" positioning weakens.
   Discipline must not erode the differentiation story.

3. **Comfortable-trap risk.** The two next build steps are deliberately in-artifact. That is
   correct for validation, but creates a risk of lingering in a form factor that structurally
   caps the GTM and the privacy claim. The trigger above exists to force the move and prevent
   this.

**Mitigation on record:** treat the artifact phase as strictly time-boxed to validating the
Confidence System and stateless categorisation. Do not add in-artifact features beyond those
two. Flip to standalone the instant a trigger fires.
