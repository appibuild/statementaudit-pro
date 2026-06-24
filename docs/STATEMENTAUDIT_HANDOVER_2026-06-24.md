# StatementAudit Pro — Handover 2026-06-24 (updated post-build)

**Changes since last handover:** Strategy session validated Layer 1 spec; then Claude Code built and deployed it. Layer 1 payee code memory is now live on Render. Section 7 model pin conflict is RESOLVED — `claude-sonnet-4-6` is deployed and verify.sh confirms 11/11 green.

**Build state (end of session):**
- Lines: **1,660** (`src/statement-audit-pro.jsx` + `client/src/App.jsx` in sync)
- verify.sh: **11/11 green**
- Latest commit: `276c0b8` — feat: Layer 1 payee code memory
- Branch: `main`, pushed to `origin/main` → Render auto-deploy triggered

**Channel:** Written in the strategy chat channel. All file edits, commits, `verify.sh` and deployment remain Claude Code's. This is the bridge — load it, run `verify.sh`, then work.

**G7 labelling:** every claim below is tagged **VALIDATED (coal face)**, **EVIDENCED (research)**, or **REASONED (unconfirmed)**. Do not promote a REASONED item to a build commitment without a real-user check.

---

## 1. ✅ BUILT — Payee code memory (Layer 1)

**COMPLETED this session.** Commit `276c0b8`. Deployed to Render on push.

**What was built (deterministic only, no model):**
- `normKey(payee, description)` → normalised uppercase lookup key
- `payeeMemory` in `localStorage` (`sa_payeeMemory`) — persists across imports, browser-only
- On extraction: remembered payees pre-filled with purple 📌 badge; unrecognised → `Misc Expense` (debit) / `Misc Revenue` (credit) in amber as holding code
- In Review: editing a nominal code sets `codeSource='edited'` + `rememberCode=true`; 📌 toggle visible per-row (defaults on); click to cancel before approval
- On Approve: all `rememberCode=true` edits written to memory — gate is the save trigger
- Export tab: "Payee Code Memory" panel — rule count, Export JSON, Import JSON, Clear All

**Layer 2 stub only** — one comment at the lookup-miss branch. No model inference built. Build Layer 2 only when a real bookkeeper confirms new-client unfamiliarity (not recurring re-coding) is the bottleneck.

**Open question to validate before Layer 2 (REASONED, unchanged):** Stephen's report is n-of-1 and best case (he recognises the payees). A bookkeeper on a brand-new catch-up client recognises nothing on statement #1 — memory compounds from period 2 onward. Confirm with one real bookkeeper whether their slow half is also recurring-recognised. If yes, Layer 1 is sufficient. If new-client unfamiliarity dominates, the suggestion layer earns its place.

**What's next:** beta test the coding memory on a real second-import cycle — process the same account's next period statement and confirm held codes pre-fill correctly.

---

## 2. Supporting build decisions

- **Pull the chart of accounts from QBO/Xero (read-only, via API).** **REASONED** — cheap, high-value, do EARLY. Makes our codes match theirs and directly feeds the coding memory.
- **Write rules BACK into their config: DEFER.** Needs OAuth + per-platform API + ongoing maintenance — the backend commitment we're avoiding until a paying customer demands it. Split from the read-only pull above; do not conflate.
- **Category *creation* (if a code doesn't exist): behind the human gate, always.** **REASONED but firm** — creating chart-of-accounts structure in a live ledger is a step up in liability vs a fixable extraction error. Suggest + require an experienced bookkeeper to approve before anything writes. Never auto-write structure.
- **Simplified annual-record output for non-QBO/Xero users: BACK POCKET, do not lead with it.** **REASONED** — real and wider (sole traders, landlords, shoebox clients who just need a record for their accountant), but it dissolves the UK-coding moat and drops us into the crowded generic PDF→CSV shelf with no differentiation. Keep as a low-cost optional output; never the headline.

---

## 3. Competitive-intelligence corrections (must cross the bridge — they were missing/stale)

The original DocuClipper research never reached the repo; the picture in older docs is wrong in places. Corrections, all **EVIDENCED (research)**:

- **Reconciliation is TABLE STAKES, not our differentiator.** DocuClipper does running-balance reconciliation on every statement. The PROJECT_INSTRUCTIONS line implying "no competitor reconciles" is **false** and needs a G3 correction.
- **Categorisation is TABLE STAKES too** (DocuClipper has rules + AI + GL coding; QBO/Xero have feed rules). Our edge is *UK-nominal-code-native* coding + the *upstream/pre-import* memory, not categorisation-as-a-checkbox.
- **DELETE the claim "balance-break detection is more rigorous than DocuClipper's fraud check."** Category error and unproven — their fraud detection is real forensic tooling (tampering/authenticity); ours is completeness (dropped rows). Different problems; "more rigorous" is indefensible.
- **DocuClipper is NOT a weak incumbent.** ~4.7/G2 on the product; the 1.5–1.8 Trustpilot is a *billing/cancellation* reputation hole, not a product failure. Don't build the case on "they're bad."
- **DocuClipper runs a "vs Claude" SEO page** asserting raw LLMs hallucinate/drop rows and are a compliance risk. Consequence: **do NOT lead marketing with "powered by Claude"** — to this buyer that phrase reads as the risk. Lead with the architecture (transcribe-then-reconcile, every number checked by code, human gate) and keep the engine an implementation detail.
- **Our real, defensible edges:** (1) UK/Channel-Islands-native accuracy on formats US tools fumble (their own help docs admit "debits and credits backwards" and "dates as NaN" on non-US layouts); (2) no-storage / EEA-hosted / audit-gated data posture that clears a compliance review the incumbents fail; (3) the upstream coding memory; (4) honest, cancellable billing vs their auto-renewal reputation.

---

## 4. Audience verdict (where to point)

- **Spine / proven market: UK & Channel Islands catch-up and rescue bookkeeping.** **EVIDENCED** — the "client didn't enter as they go" job. Willingness-to-pay is proven (people pay DocuClipper/Datamolino today). This is Stephen's own 1999-restaurant pain.
- **Beachhead / underserved: Channel Islands small businesses + the local accountants who serve them.** **EVIDENCED + REASONED** — QBO/Xero are built for UK/US/AU tax and feeds; CI has no VAT/MTD and CI/offshore banks often don't feed at all, so more manual statement work, with US tools fumbling the formats. Reachable through Stephen's consultancy network — the one advantage no US tool can buy.
- **Premium layer: compliance-gated profiles (law/estate-agent/charity client money; trust).** **REASONED** — here the no-storage posture is the *deciding* purchase criterion, not a nicety.
- **Trust/CSP as a SEPARATE market: lean NO-GO.** **EVIDENCED, moderate confidence.** Upper tier is locked by Quantios (TrustQuay + Viewpoint merged 2024) which already bundles accounting + FATCA/CRS/UBO; a small off-platform tier exists (~776 registered TCB persons in Jersey incl. sole practitioners) but the generic offshore-PDF→Xero job is already served (Datamolino, EntryRocket, et al.), and the regulatory-reconciliation gap is a *different workstream our product doesn't do*. Trust is a high-value *sub-segment of the catch-up market*, not a separate kingdom. Don't build *for* it; let it self-select via the no-storage edge.

**Through-line:** the audience isn't a vertical — it's *anyone in the UK/CI who handles statements US tools fumble and whose data won't survive a US-web-tool compliance review*. Build the two edges (UK/CI coding + no-storage) to the hilt; let verticals self-select.

---

## 5. Strategic posture (changes effort allocation)

Stephen's decision: **ship a demonstrable beta as the test, adapt from real signal — do not over-polish one app that may peter out.** This is part of a portfolio play (multiple app projects, possibly consolidated into one demonstration platform; pension income built on commissions while hoping one app finds a sweet spot).

**Implication for Claude Code:** build the ONE validated differentiator (coding memory), ship it behind a beta portal, and stop there until real users generate signal. Do NOT gold-plate. Defer OAuth/rules-write-back/simplified-record/model-suggestion until a real user asks.

---

## 6. Beta portal + the data-handling gate (do not skip)

- A beta portal is the right next move — cheap, and it finally generates the coal-face signal all the desk research could not (real users actually coding, telling us if the memory engine earns its keep).
- **GATE (REASONED but firm):** the moment a real bookkeeper uploads a real client statement, we hold other people's financial data. Before the portal accepts ANY outside statement: make the no-storage claim *true and stated*, publish a basic privacy line, and confirm the data-flow. Not the full JOIC/DPA pack yet — but not nothing. **Consult the Compliance & Data-Protection adviser before it goes live to anyone but Stephen.**

---

## 7. ✅ RESOLVED — Model pin conflict

`claude-sonnet-4-6` is the deployed model. `claude-sonnet-4-20250514` was **retired** by Anthropic mid-session in a prior session — the model update was forced by retirement, not an elective change. verify.sh 11/11 green confirms `claude-sonnet-4-6` is live. VERSION updated to match. No open conflict.

---

## 8. Suggested doc maintenance (G3)

- Correct the PROJECT_INSTRUCTIONS competitive framing (reconciliation/categorisation = table stakes; remove "no competitor reconciles" and the "more rigorous fraud check" line).
- Capture the competitive intelligence (Section 3) and audience verdict (Section 4) into a decision record so they stop evaporating between sessions.
- Reconcile the model-pin line once Section 7 is resolved.

---

## 9. Non-negotiables carried forward (unchanged)

Human approval gate is the only path to CSV. Model transcribes; code does the arithmetic. Robust indexOf/lastIndexOf JSON extractor; no prefill. UTF-8 BOM. DD/MM/YYYY in display/prompts/CSV body. One general rule per account type. API key server-side only. Never persist real personal bank details. Gate changes need the full board + consensus.

---

*Resume protocol: load this handover + the live `src/statement-audit-pro.jsx`, run `verify.sh` (expect ALL CHECKS PASSED), then start with Section 1.*
