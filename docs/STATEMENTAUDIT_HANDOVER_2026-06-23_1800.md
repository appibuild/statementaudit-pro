# StatementAudit Pro — Session Handover

**Date:** 2026-06-23 (evening, ~18:00)
**Changes since last handover:** Jobs A (parse-failure raw capture) + B (cross-statement duplicate viewer) landed; B was found mis-wired and fixed (`3981a50`); dead `renderDash` removed (`5ca6fc7`, −133 lines, now 1,568). 3A **downgraded to a watch item**; credit-card reconciliation **verified live on real data**; duplicate viewer **verified live**. **Hosting decided: Render (Starter, Frankfurt).** New board seat: **Compliance & Data-Protection** (board now eight). Commercial/pricing analysis **recovered and parked**. Roadmap: **close the lab → standalone MVP → beta on QBO/Xero sample companies.** **Supersedes `STATEMENTAUDIT_HANDOVER_2026-06-23_1700.md` — commit this one, discard the 1700 draft.**

**Follows G7:** every claim carries `VERIFIED LIVE` (live check named) or `REASONED (unconfirmed)`. Untagged = unconfirmed.

---

## How to resume (read this first)

1. Paste this handover as the first message.
2. `bash verify.sh` → expect **ALL CHECKS PASSED**, line count **1,568**, latest commit `5ca6fc7`.
3. **This is a phase boundary.** In-artifact build work is done. The next session is the **standalone MVP** — a fresh start, hosting already decided (Render).
4. Git hygiene to clear first (see "Loose ends").

---

## What landed this session — all committed

- **Jobs A + B** — build 1,651 → 1,702 (hash via `git log`).
- **Dupe viewer fix** (`3981a50`, 1,701) — re-homed the viewer from the dead `renderDash` into `renderAudit`; made the Review-screen alert clickable.
- **Tidy-up** (`5ca6fc7`, 1,568) — removed dead `renderDash` (−133 lines); one duplicate-alert path now, in `renderAudit`; header + `VERSION` (`expected_lines` → 1568) updated. `verify.sh` green.

---

## Status of each claim (G7 tags)

- **Job B — cross-statement duplicate viewer:** `VERIFIED LIVE` — on the Review screen, the red "duplicates across statements — click to review" badge opens the read-only panel; all pairs listed with date/payee/signed amount, both statements side-by-side, working jump-to-statement, Close. **Caveat — `REASONED (unconfirmed)`:** tested only on *identical re-uploads*; the distinct-period duplicate case is unverified.
- **Job B first build mis-wired:** `VERIFIED LIVE` (failure + fix) — viewer was orphaned in `renderDash` (no tab renders it); caught by live test, fixed. Lesson: "compiles" ≠ "reachable."
- **Job A — raw capture on parse failure:** `REASONED (unconfirmed)` — code in (`rawResponse` captured in `catch` only, cleared on re-run/success, "Show raw response" toggle on error rows). Nothing errored, so never triggered. Honest, not broken.
- **3A — BP-coded money-in direction:** `VERIFIED LIVE` — every BP-in row landed as credit across a real HSBC statement, the 2024 fixture, and a multi-statement batch (proven by penny-exact reconciliation to banks' own Payments In totals). **Watch item; prompt untouched** (see `DECISION_RECORD_2026-06-23_1400`).
- **Credit-card statements reconciling on real data:** `VERIFIED LIVE` — first time off paper. Debit-positive polarity correct, PMT as credit, "no running balance" honesty line correct on no-balance cards.
- **Tidy-up:** `VERIFIED LIVE` — `verify.sh` 11/11 at 1,568; tab switcher confirmed never to reference `renderDash`.

---

## Decisions logged this session

- **Data handling** — `DECISION_RECORD_2026-06-23_1400_3A-bp-direction-and-data-handling.md`. Commercial API (no training, 7-day/ZDR) is stricter than consumer Claude.ai. Routine testing → synthetic/sample data; real own/consenting for spot-checks only.
- **Roadmap — defer categorisation, standalone MVP next** (board-consulted). **G5 conflict named:** prior plan said build categorisation in-artifact *before* standalone; board reversed it — the artifact validates extraction correctness but **cannot** validate feature desirability (no real user can touch it). Build categorisation only if beta proves the need.
- **Hosting + compliance** — `DECISION_RECORD_2026-06-23_1800_hosting-board-compliance.md`:
  - **Hosting:** Render (Starter, always-on), Frankfurt/EU. Deciding factor: Render web services allow ~100-min requests (no serverless cut-off mid-extraction); EU storage; low ops; ~£6–11/mo (no "hundreds" path until revenue-scale). US company (CLOUD-Act) accepted for MVP; not locked in.
  - **New board seat:** Compliance & Data-Protection (now eight). Role-defined, stands in for a real professional at go-live.
  - **Go-live compliance gate** (before first *real* customer, not for sample-data beta): DPA to offer customers; sub-processor terms (Anthropic DPA w/ SCCs + UK addendum; host DPA); confirmed US-transfer basis (DPF *or* SCCs + risk assessment — Anthropic's DPF-certification status is disputed in public sources, verify on the official list); JOIC registration (Jersey); privacy policy; security baseline. Not-a-lawyer; retain a real Jersey+UK professional at this gate.

---

## The roadmap (best-advantage sequence)

1. **Close the lab (now).** This handover + commit; clear git loose ends; optionally add synthetic seeded test statements as a regression set. Stop adding to the extraction core.
2. **Standalone MVP (next phase).** Node/Express proxy (holds the API key) + existing React frontend, on **Render Starter, Frankfurt**. **Minimum scope: no OAuth, no direct API push, no metering, no database** — just upload → extract → review → approve → CSV download, live.
3. **Beta on QBO/Xero sample companies.** Stephen self-plays the Practice Manager — tests the never-yet-tested CSV *import* into QBO/Xero, holds no real personal data (within test policy). Measure before/after hours. De-risks three unknowns: does categorisation matter, the right price, the Ogilvy case study.
4. **Build what beta proved.** Likely categorisation if wanted (lean, rules-first); then pricing and marketing with real numbers; then the compliance go-live pack before the first real paying customer.

---

## Parked for the marketing/beta phase (recovered, decisions deferred)

Full 18-June pricing analysis recovered from past chats (never reached a handover before). **No pricing decided now.** Revisit at beta: API ≈ £0.13–0.31/statement; heavy-user margin needs a fair-use ceiling; DocuClipper/Angus both weak incumbents; personas Solo £25 / Practice £65 (the evidence-based figures that **superseded** an earlier £15/£35 — G5).

---

## Loose ends / git hygiene (clear before standalone work)

- `docs/GUARDRAILS.md` has a **staged-but-uncommitted edit** (likely the G7 addition) — review and commit.
- **Files to add/commit this session:** updated `STATEMENTAUDIT_PROJECT_INSTRUCTIONS.md` (board→8, hosting, test-data line, header bump); `DECISION_RECORD_2026-06-23_1400_*`; `DECISION_RECORD_2026-06-23_1800_*`; this handover. **Discard the 1700 handover draft.**
- Optional: synthetic seeded test statements (online layout references only — never real personal data).

---

## Board of Advisers — eight

Amy Hoy · Jason Fried · UK Practice Manager · Paul Jarvis · David Ogilvy · Angus Cheng · Simon Willison · Compliance & Data-Protection adviser (enrolled 2026-06-23). Gate-level changes need all members + consensus. No gate change this session.

---

## Current state

- **App:** 1,568-line build, `verify.sh` green, latest commit `5ca6fc7` on `master`.
- **Commits this session:** Jobs A+B (→1,702, hash via `git log`), `3981a50` dupe-viewer fix (1,701), `5ca6fc7` tidy-up (1,568).
- **Provider:** Anthropic, pinned `claude-sonnet-4-20250514`. Benchmark before any change.
- **Hosting (decided):** Render Starter, Frankfurt/EU.

---

## Non-negotiables (unchanged)

Pinned model `claude-sonnet-4-20250514`; `max_tokens: 32000`; robust `indexOf`/`lastIndexOf` JSON extractor, no prefill; `@`/`Visa Rate` foreign-transaction rule; credit-marked-balance rule; UTF-8 BOM; DD/MM/YYYY in display/prompts/CSV body; mandatory human approval gate as the only path to CSV (hard-blocked on non-reconciliation); one general rule per account type, no per-bank prompt library; model transcribes, code does the arithmetic; never persist real personal bank details; synthetic / own / consenting / sample-company / public-authority test data only.

---

## Next steps

1. Clear git loose ends; commit the updated project instructions, both decision records, and this handover.
2. **Open the standalone MVP as a fresh session.** First move: scaffold the Render Starter (Frankfurt) deploy — static frontend + Node/Express proxy holding the API key — minimum upload→approve→CSV flow. No OAuth, no push, no DB, no metering.
3. Stand up beta on QBO/Xero sample companies; measure before/after hours.
4. Revisit categorisation and pricing after beta; build the compliance go-live pack before the first real paying customer.
5. Close each session with a dated handover + commit.

---

*Standing rules: plain language · verify in the running app · separate proof from guess · evidence before fixes · human gate non-negotiable · make silent failure loud · minimum change · confirm before any file save or delete · never persist real personal bank details. Lessons this session: "compiles" is not "reachable"; the validation lab can prove extraction is right but cannot prove a feature is wanted — that needs a real user; and the cheapest sovereign host only protects the storage leg, since inference still reaches the US API.*
