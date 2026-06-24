# Decision Record — Hosting, Compliance Board Seat & Go-Live Compliance Checklist

**Date:** 23 June 2026 (~18:00)
**Status:** Decided. Hosting locked for the standalone MVP. New board seat enrolled. Compliance checklist is a *go-live gate*, not an MVP cost.
**For:** Feeds the standalone MVP session and the next handover. Companion to `DECISION_RECORD_2026-06-23_1400_3A-bp-direction-and-data-handling.md`.
**Not legal advice.** The compliance content below is general information to scope the work and brief a qualified professional — it does not replace one. Live regulatory facts were web-verified on 2026-06-23 and should be re-checked at go-live, as they move.

---

## Plain summary

The standalone app will be hosted on **Render (Starter, always-on) in the Frankfurt/EU region** — chosen because it won't cut off a long extraction call, keeps data in the EU, is low-maintenance, and costs ~£6–11/month (no path to "hundreds" until real scale, by which point revenue covers it). A **Compliance & Data-Protection adviser** joins the board (now eight). A full compliance pack is required **only before the first real customer with real client data** — not for self-played beta on sample companies.

---

## Decision 1 — Hosting

**Chosen: Render, Starter tier (paid, always-on), Frankfurt (EU) region.** Frontend (static React), proxy (Node/Express holding the API key), and — later — Postgres all in one place.

**Why (board: Simon Willison, Angus Cheng, Paul Jarvis, Jason Fried, UK Practice Manager):**
- **No mid-job cut-off.** The worry was a long Anthropic call being killed partway. That's a *serverless* timeout (Vercel functions cap at minutes; simple proxy rewrites at 120s). Render web services allow an HTTP response up to ~100 minutes — the extraction always finishes. This was the deciding factor.
- **EU data residency** (Frankfurt) — data stays in the EEA; fine for UK and Jersey (both adequacy-recognised).
- **Low ops** — git-push deploy, managed Postgres when needed, one dashboard. A solo founder shouldn't be patching servers.
- **Cost fits the constraint** (see below).

**Cost (the "£10+ fine, not hundreds" constraint):**
- Frontend: £0 (static hosting).
- Proxy: Render Starter ≈ $7/mo (~£5.50), always-on — the paid tier removes the free tier's 15-minute idle sleep (which only delays the *first* request after idle; it never interrupts a running job).
- Database: not needed for the MVP. Add Render Postgres (~$7/mo) only when persistence/accounts arrive → ~$14/mo (~£11) total.
- **Anthropic API** is the only usage-scaling cost (~£0.13–0.31/statement) — revenue-linked, not a fixed burn; pennies at beta scale.
- "Hundreds/month" only occurs at real customer scale, funded by revenue. No surprise-bill path at this stage.

**Trade-off accepted:** Render is a US company, so it carries CLOUD-Act exposure. Mitigated by EU storage and acceptable for MVP. Not locked in — it's a standard Node + Postgres app, easy to move if a customer ever requires EU-sovereign hosting.

**Rejected alternatives:** Vercel for the proxy (serverless timeouts → would need streaming gymnastics); a raw VPS / EU-sovereign host like Hetzner (cheapest and best on sovereignty, but ops burden, and it only protects the *storage* leg — inference still hits the US Anthropic API).

---

## Decision 2 — Board seat: Compliance & Data-Protection adviser (now eight)

Enrolled as a **role-defined seat** (UK GDPR, Data Protection (Jersey) Law 2018 / JOIC, EU cross-border transfers, processor/sub-processor duties, financial-data handling). It stands in for the qualified professional to be retained at go-live — **not a substitute for one.** Consult before go-live, before adding persistence/accounts, before any provider or region change, and before publishing any privacy marketing claim. Full board is now: Amy Hoy, Jason Fried, UK Practice Manager, Angus Cheng, David Ogilvy, Paul Jarvis, Simon Willison, Compliance & Data-Protection.

---

## Decision 3 — Go-live compliance checklist (gate before first real customer)

**Roles in the data flow:** the bookkeeper's client (and people in the transactions) are the data subjects; the **bookkeeper/practice is the controller**; **StatementAudit Pro's business is the processor**; **Anthropic and the host are sub-processors.**

**The pack to have in place before onboarding a real customer with real data:**
1. **A DPA to offer each customer** (you as processor: process only on instruction, security, sub-processor disclosure).
2. **Back-to-back sub-processor terms.** Anthropic's commercial DPA is auto-incorporated into its Commercial Terms and includes SCCs (Modules 2/3) + the UK International Data Transfer Addendum (Irish governing law). The host needs its own DPA.
3. **US-transfer mechanism, confirmed.** Two possible bases: the EU-US Data Privacy Framework / UK Extension (valid as of 2026, survived its first court challenge late 2025, but only covers *certified* US recipients) OR the SCCs already in Anthropic's DPA plus a Transfer Risk Assessment. **Open item (G5 — sources conflict):** whether Anthropic itself is currently DPF-certified is disputed in public sources — verify on the official DPF list at go-live. SCCs are the dependable basis regardless.
4. **CLOUD Act honesty.** A US provider can in principle be compelled under US law even with EU storage. EU storage reduces, not eliminates, this. Keep any "data stays in the EU" claim accurate.
5. **True EU residency (if ever required)** is about *where Claude runs*, not just the host: route via an EU cloud endpoint (e.g. Bedrock Frankfurt, where AWS is processor and DPF-certified). Direct Anthropic API doesn't guarantee it. Later lever, not MVP.
6. **JOIC registration (Jersey).** The business sits under DPL 2018; register with the Jersey Office of the Information Commissioner and pay the fee. Jersey is adequacy-recognised by EU and UK, so data flows freely to/from Jersey. Confirm specifics with the JOIC.
7. **Security baseline** — encryption in transit + at rest, access control. The **no-document-storage design is a genuine compliance asset** (data minimisation).
8. **Breach notification** to the controller; **privacy policy**; a basic record of processing.

**Not triggered:** bank-statement data is sensitive but **not** "special category" under GDPR (no extra special-category conditions). As a software processor you're not doing regulated financial activity / AML yourself — that stays with the bookkeeper.

**Timing:** none of the above is needed for self-played beta on QBO/Xero **sample companies** (no real personal data, no customer to contract with). It becomes a hard gate before the first real customer — and that's the point to spend money on a real data-protection professional familiar with Jersey + UK (modest cost against the risk).

---

## Status / next

- **Hosting:** locked — Render Starter, Frankfurt, for the standalone MVP.
- **Board:** eight seats; Compliance seat live.
- **Compliance pack:** go-live gate; nothing required for sample-data beta.
- This is a dated-series record — keep it; do not overwrite.
