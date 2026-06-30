# StatementAudit Pro — Beta Readiness Test Plan (v3)

**Changes since v2:** added Suite K (compliance & claims verification — privacy-copy accuracy + no-server-retention); re-weighted J4 (cloud token) from "worth a look" to a gate-relevant decision under the SaaS model; added a Code-side actions list. All v2 suites unchanged.

**Reconciled against live source:** `statement-audit-pro.jsx` (4,821 lines) + `server/index.js`, 2026-06-30. **Supersedes v2.**
**Model pins:** extraction `claude-sonnet-4-6` (jsx line 1352) · Layer-2 suggestions `claude-haiku-4-5` (server).
**Decision context:** product stays **multi-tenant SaaS** (see `DECISION_RECORD_2026-06-30_HOSTING-AND-LIABILITY-MODEL.md`). This plan tests the SaaS product. No self-host paths are in scope.

Purpose: confirm every shipped process works in the **running Render app** before 5 professional testers touch it. The five most-recently-shipped features (OAuth, GST/VAT, tracking, Layer 2, workspace) are tested first — newest = least-proven; verify.sh checks fingerprints, not live function.

---

## How to use this

- Run against live Render, not a local build. Mark **Result**: `✅` · `❌` · `⚠️` partial · `⏭️` blocked (env not configured) · `N/A`.
- On any `❌`/`⚠️`: capture the statement used, a screenshot, and (on extraction faults) the raw model response.
- A suite is green only when every case is `✅` or justified `N/A`.

### Test-data policy (confirmed under the SaaS decision)
The compliance gate is open (JOIC, Render DPA, Anthropic DPF/ZDR, Privacy Policy, Customer DPA, RoPA, Breach procedure, TRA — all outstanding).

- **Allowed now:** synthetic statements (the 38-file suite), a tester's **own business** statements, or QBO/Xero sample-company data.
- **Not allowed until the gate closes:** a tester's **real client** statements — free *or* paid. Processing a bookkeeper's clients' data makes you a processor regardless of payment. (This is tighter than the handover's "own or consented client statements" wording — this version holds.)

### Environment preconditions (features 501-error if unset)
| Env var | Gates | Set? |
|---|---|---|
| `ANTHROPIC_API_KEY` | all extraction + suggestions | __ |
| `VITE_GOOGLE_CLIENT_ID` | Google Drive sync (E1) | __ |
| `VITE_MICROSOFT_CLIENT_ID` | OneDrive + M365 Workspace (E2, E7) | __ |
| `VITE_XERO_CLIENT_ID` + `XERO_CLIENT_SECRET` | Xero CoA OAuth (E5) | __ |
| `VITE_QBO_CLIENT_ID` + `QBO_CLIENT_SECRET` | QBO CoA OAuth (E6) | __ |
| `VERSION` expected_lines = 4824, verify.sh 13/13 | build integrity | __ |

---

## Suite A — Core pipeline (the gate is the product)

| ID | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| A1 | Multi-PDF upload (to 50) | Drag-drop mixed PDFs; set type + jurisdiction each | All queued; settings respected | |
| A2 | Process All | Run | Live status; sequential; pause between calls | |
| A3 | Extraction → review | Open each | Transactions, dates, payees, debit/credit, running balance populated | |
| A4 | Reconciliation strip | View | 7-figure strip visible before approval | |
| A5 | Inline edit recalcs | Edit an amount | Reconciliation updates instantly | |
| A6 | Editable opening/closing | Override a balance | Recon updates | |
| A7 | **Approve gate — happy path** | Approve a reconciled statement | CSV downloads; status → Approved | |
| A8 | **Approve gate — hard block** | Approve a statement with variance ≥ £0.02 | Blocked; no path to CSV; reason shown | |
| A9 | Roll back | Approved → Review | Returns; prior export not lost | |
| A10 | "No transactions found" | Process an empty statement | Clear message, no crash | |
| A11 | 429 handling | During usage limit | Friendly "wait and Run again" | |

**A7 and A8 are the trust spine — never let them regress.**

---

## Suite B — Dual-extraction cross-check (server-side)

`/api/extract` runs the LLM and text-layer extractor in parallel and attaches `_textExtract`.

| ID | Scenario | Statement needed | Expected | Result |
|---|---|---|---|---|
| B1 | Agree | Clean current account, standard 3-col | `available:true`, status **agree**; no warning | |
| B2 | Partial / count_mismatch | Two paths differ | Status **partial**/**count_mismatch**; flagged rows; red ⊕ | |
| B3 | HSBC current-account null (known) | HSBC Advance | Text layer null → `available:false` → LLM result returned **unchanged**, graceful | |
| B4 | HSBC credit-card count_mismatch (known) | HSBC CC | count_mismatch; ⊕ fires; LLM extraction accurate | |
| B5 | Cross-check never blocks alone | Any | Informs review; the *reconciliation* gate blocks, not the cross-check | |

> B3/B4 are **expected graceful degradation**, not bugs.

---

## Suite C — Reconciliation & correctness edge cases

| ID | Scenario | Statement needed | Expected | Result |
|---|---|---|---|---|
| C1 | Lloyds opening trap | "Balance on [date]" incl. day-one txn | True opening auto-applied; "brought forward" note; no click | |
| C2 | Two-anchor disagree | Anchors disagree | Flags; manual fix offered | |
| C3 | HSBC missing-row | Dropped row | Red break banner naming the date span | |
| C4 | CR credit-balance opening | Credit/loan CR summary | Opening NEGATIVE; current account unaffected | |
| C5 | Direction by column | Code in opposite money column | Column wins | |
| C6 | FX line | "@"/"Visa Rate"/international | GBP kept; line never dropped; 💱 badge; FX rate reference-only | |
| C7 | Duplicates | Two statements sharing a txn | Flagged; read-only viewer; jump works | |
| C8 | Period gap/overlap | Gap between statements | Detected | |
| C9 | Account-type misdetect | Mis-typed statement | One-click switch; recon corrects | |
| C10 | Every account type reconciles | Current, Savings, Credit Card, Business, ISA/Cash ISA, Mortgage | Correct polarity; calculatedClosing matches | |

---

## Suite D — Confidence + fast-track

| ID | Scenario | Expected | Result |
|---|---|---|---|
| D1 | 7-factor score | 0–100, recomputes on edit | |
| D2 | Tiers | ⚡ High 95+ / Good 80–94 / Fair 70–79 / Review <70, hover reason | |
| D3 | Fast-track uses the same gate | ⚡ Approve routes through the identical gate handler — no bypass | |

---

## Suite E — Third-party integrations (deepest coverage)

### E1 — Google Drive (personal) — pre: `VITE_GOOGLE_CLIENT_ID` set
| ID | Scenario | Expected | Result |
|---|---|---|---|
| E1.1 | Connect / OAuth | Google consent → return connected | |
| E1.2 | Upload sync | File lands in Drive **appDataFolder** as `sa_stmt_…` | |
| E1.3 | Reload restore | Reconnect → statements load back | |
| E1.4 | Expired/revoked token | Clear re-auth; no silent failure, no data loss | |
| E1.5 | Disconnect | `sa_cloud*` keys cleared; local-only restored | |

### E2 — OneDrive (personal) — pre: `VITE_MICROSOFT_CLIENT_ID` set
| ID | Scenario | Expected | Result |
|---|---|---|---|
| E2.1 | Connect / OAuth | Microsoft consent → return connected | |
| E2.2 | Upload sync | File lands in OneDrive **approot**, `sa_stmt_…` | |
| E2.3 | Reload restore | Reconnect → load back | |
| E2.4 | Expired/revoked | Clear re-auth | |

### E5 — Xero CoA OAuth pull — pre: `VITE_XERO_CLIENT_ID` + `XERO_CLIENT_SECRET` set
| ID | Scenario | Expected | Result |
|---|---|---|---|
| E5.1 | Not configured | Secret missing → 501 "Xero CoA not configured" cleanly | |
| E5.2 | Connect (PKCE) | Click → **Xero** consent (identity.xero.com) → return | |
| E5.3 | Tenant + CoA pull | Tenant resolved; chart of accounts into autocomplete | |
| E5.4 | Token not persisted | Access token NOT in localStorage/sessionStorage/state (PKCE verifier removed post-exchange) | |

### E6 — QBO CoA OAuth pull — pre: `VITE_QBO_CLIENT_ID` + `QBO_CLIENT_SECRET` set
| ID | Scenario | Expected | Result |
|---|---|---|---|
| E6.1 | Not configured | Secret missing → 501 "QBO CoA not configured" cleanly | |
| E6.2 | Connect | Click → **Intuit** consent → return | |
| E6.3 | CoA pull | Chart of accounts into autocomplete | |
| E6.4 | Token not persisted | Access token not persisted | |

### E4 — CoA CSV import (fallback, no OAuth)
| ID | Scenario | Expected | Result |
|---|---|---|---|
| E4.1 | Valid CSV | Code/Name detected; autocomplete `CODE — Name (Type)` | |
| E4.2 | Wrong columns | Clear "Code/Name not found" guidance | |

### E7 — M365 Practice Workspace (multi-user — run with two accounts)
Pre: OneDrive connected, workspace mode active.
| ID | Scenario | Expected | Result |
|---|---|---|---|
| E7.1 | Create workspace folder | Shared folder created (Files.ReadWrite); share URL generated | |
| E7.2 | Statement → workspace | Approved statements save to **workspace** folder, not personal approot | |
| E7.3 | Memory write | Confirming codes pushes `workspace_memory.json` to the shared folder | |
| E7.4 | **Memory read-back (critical)** | Second user opens the shared workspace → does User A's payee/CoA/tracking memory appear for User B? | |
| E7.5 | **Concurrency (critical)** | Both users edit memory near-simultaneously | Confirm whether last-write-wins **clobbers** one user's codes — and whether the UI warns | |

> E7.4/E7.5 are the genuine unknowns — write path verified in source; read-merge and concurrency are not.

---

## Suite F — Coding pathways & tax treatment

| ID | Scenario | Expected | Result |
|---|---|---|---|
| F1 | QBO Code & Reference | 9-col CSV; codes as reference; CSV does not claim QBO auto-applies | |
| F2 | Xero Code & Create | Per-line confirm gate → `_PRECODED.csv` with Account Code | |
| F3 | Empty-period assertion | Hard checkbox blocks import into a non-empty period | |
| F4 | **Jersey GST → Tax Rate** | Pick each treatment → CSV Tax Rate carries correct Xero name: Standard→GST on Income/Expenses (debit-aware), Zero, Exempt, ISE→Zero Rated, Outside→No GST | |
| F5 | **UK VAT → Tax Rate** | Correct Xero names, debit/credit-aware (Income vs Expenses) | |
| F6 | Other jurisdiction | Tax column hidden; no treatment applied | |
| F7 | **Layer 2 ✦ suggestion** | Uncoded payee not in memory → purple ✦; suggestion is a **proposal**; must ✓; no auto-apply; ✦ clears on confirm | |
| F8 | Tracking assignment | Assign up to 2 per line → tracking1/2 written to precoded CSV; remembered per payee | |
| F9 | Payee memory | Remembered badge on next statement with same payee | |
| F10 | Auto-confirm switch | Bulk-confirms only remembered lines | |

---

## Suite G — Outputs & file integrity

| ID | Scenario | Expected | Result |
|---|---|---|---|
| G1 | QBO CSV | 9-col; Debit/Credit positive; unused blank | |
| G2 | Xero plain CSV | Amount signed; Reference=payment type | |
| G3 | Xero precoded CSV | Account Code + Tax Rate + Tracking1/2 populated correctly | |
| G4 | Audit Workbook | 3 sheets; treatment labels resolved; figures match | |
| G5 | Merge across approved | Project's approved statements → one file | |
| G6 | File naming | `Bank_YYYY-MM-DD_to_YYYY-MM-DD_PLATFORM.csv` | |
| G7 | Date format | DD/MM/YYYY body; YYYY-MM-DD filename | |
| G8 | UTF-8 BOM | Opens clean in Excel | |
| G9 | 2dp precision | No float drift | |
| G10 | Receipt download | Opens with sensible name | |

---

## Suite H — Projects, UX, navigation

| ID | Scenario | Expected | Result |
|---|---|---|---|
| H1 | Projects lifecycle | Create/rename/delete; statements update; counts + last-activity | |
| H2 | Tabs | upload → queue → audit → export coherent | |
| H3 | Keyboard shortcuts | A/R/←→/?; only in Review with no input focused | |
| H4 | Guide Mode | Tooltips toggle; persist | |
| H5 | Help panel | Searchable; slides in | |
| H6 | Backup/restore rules | Export/import payee rules `.json` across devices | |
| H7 | Theme | Light/dark render correctly | |

---

## Suite I — Non-negotiable regression (must all hold)

| ID | Standard | Confirm | Result |
|---|---|---|---|
| I1 | Human gate is the only path to CSV | No auto/bulk approve | |
| I2 | Reconciliation visible before approval | Strip never hidden | |
| I3 | Model transcribes; code computes | Totals/recon/opening derived in code | |
| I4 | **GST/VAT arithmetic firewall** | `gstJersey`/`vatUK` never in recalc, balance-walk, reconciliation, or BASE_PROMPT/PROMPTS | |
| I5 | FX reference-only | Never in arithmetic or any CSV | |
| I6 | CoA tokens not persisted | Xero/QBO tokens absent from localStorage/sessionStorage/state | |
| I7 | Layer 2 proposals only | Human ✓ required; no auto-apply path | |
| I8 | 2dp; DD/MM/YYYY; UTF-8 BOM; robust JSON extractor; no prefill | | |
| I9 | One rule per account type | No per-bank prompt zoo | |

---

## Suite J — Build integrity & security review

| ID | Item | Confirm | Result |
|---|---|---|---|
| J1 | Two-file sync | `src/statement-audit-pro.jsx` == `client/src/App.jsx`; deployed app is canonical source | |
| J2 | VERSION / verify.sh | expected_lines = 4824; verify.sh 13/13 | |
| J3 | No `React.` references | none (would throw in production) | |
| J4 | **Cloud token — gate-relevant decision (re-weighted under SaaS)** | `sa_cloudToken` (Google/MS) persists to localStorage with broad **Files.ReadWrite** scope. Under SaaS you are the processor, so the blast radius of a future XSS is a **gate decision, not a note**: either narrow Microsoft to `Files.ReadWrite.Selected` (limits the grant to the workspace folder), or obtain explicit Compliance-adviser sign-off on the broad scope. Resolve before real client data. | |
| J5 | Stale code comment | Line ~459 "Tracking1/2 … empty columns for future use" contradicts working write at ~482 — delete | |

---

## Suite K — Compliance & claims verification (NEW)

Your privacy posture is the differentiator and is load-bearing for compliance, so it gets tested as a property of the running system, not taken on label.

| ID | Item | Confirm | Result |
|---|---|---|---|
| K1 | **No screen overclaims privacy** | No UI/help/marketing string says data is "never stored" or "never passes through our servers" in a way that is untrue. Correct framing present: **"processed in memory only, never stored; hosted in the EEA."** (Code-side reword required — see actions.) | |
| K2 | **No server-side retention** | On Render: no database holding statements; no temp PDF/statement files written to disk during `/api/extract`; the PDF payload is **not** written to application logs. Statement data exists only in the browser session and the user's own cloud. | |
| K3 | **Zero-storage is verifiable** | After processing, confirm nothing persists server-side: a fresh server has no statement artefacts; restart loses no user data because none was held. | |
| K4 | **Claim sign-off** | The reworded privacy claim is approved by the Compliance seat before any tester sees it (and by the retained professional before public launch). | |

> K1–K3 must pass before the privacy claim appears anywhere a tester reads it. K2 is the substance behind the headline — if Render ever logs or temp-writes the payload, the "zero storage" claim is false regardless of the copy.

---

## Code-side actions arising — status 2026-06-30

All four actions completed in this session (13/13 verify.sh green, expected_lines updated to 4824):

1. ✅ **Privacy copy reworded** — line 4108 now reads "Processed in memory only — never stored on our servers. EEA-hosted." False "never passes through our servers" claim removed. (→ K1)
2. ✅ **Microsoft OAuth scope documented** — `Files.ReadWrite` is required; `Files.ReadWrite.Selected` and `Files.ReadWrite.AppFolder` both fail for workspace (no programmatic folder access / app-private respectively). 3-line comment added at jsx lines 688-691 explaining why and asserting Compliance adviser sign-off is required before real client data. (→ J4)
3. ✅ **Stale tracking comment deleted** — line ~459 corrected to reflect that tracking1/2 are actively written from `t.tracking1/t.tracking2`. (→ J5)
4. ✅ **No-retention contract asserted in code** — 3-line comment added above `/api/extract` in `server/index.js` stating the no-persistence contract and giving a grep command to verify it hasn't silently regressed. (→ K2)

---

## Run order

`verify.sh` → **A (gate)** → **I (regression)** → **K (claims/retention)** → **B (dual-extraction)** → **E5/E6/E7 + F4/F5/F7/F8 (newest features)** → C → D → E1/E2/E4 → G → H → J.

Stop and fix before recruiting if any of these fail: **A7, A8, I1, I2, I3, I6, I7** (trust + safety spine), **K1–K3** (privacy claim must be true before a tester reads it), **E7.5** if it silently clobbers shared memory, and resolve **J4** before real client data.

---

*v3 reconciled to source 2026-06-30, under the SaaS hosting decision. Supersedes v2. Submit to Claude Code docs.*
