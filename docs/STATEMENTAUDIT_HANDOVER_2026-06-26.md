# StatementAudit Pro — Handover 2026-06-26

**Build:** commit `c20688c` — live on Render (deployed 05:07 PM, "Your service is live 🎉")
**verify.sh:** 11/11 green · Lines: 3,426
**Branch:** `main` — fully synced with `origin/main`, nothing pending commit

---

## Resume protocol

```bash
cd statementaudit-pro
bash verify.sh                    # must be 11/11 green
```

Then load this file + `src/statement-audit-pro.jsx`.

---

## What was built this session (2026-06-26)

### 1. Google Drive + OneDrive BYOC cloud storage (`02fe4bf`)
Full OAuth PKCE flow for both providers — no server secret needed.

- `CLOUD_CFG` with `import.meta.env.VITE_GOOGLE_CLIENT_ID` / `VITE_MICROSOFT_CLIENT_ID`
- `generatePKCE`, `cloudSaveStmt`, `cloudLoadAll`, `cloudGetUser` (module-level)
- OAuth callback useEffect handles `?code=` redirect on return from auth screen
- Auto-save useEffect: approved + `!cloudSaved` statements upload to cloud automatically
- `startCloudAuth` (PKCE redirect) + `disconnectCloud` handlers
- ☁ Cloud nav button — green "Synced" when connected, "↻ Syncing" during sync
- Cloud panel: connect buttons, connected status with username, storage counts, disconnect
- Activity panel footer updated to reflect live cloud sync status

### 2. Cloud setup instructions + env var support (`3a903e2`)
- `CLOUD_CFG` now reads from `VITE_GOOGLE_CLIENT_ID` / `VITE_MICROSOFT_CLIENT_ID` env vars — set in Render, no source edit needed
- Cloud panel: expandable Google + OneDrive setup accordions, 8-step numbered guides, Render env var instruction
- Help panel: new "Cloud Storage Setup" section (5 Q&As: prerequisites, Google steps, OneDrive steps, redirect URI, single-provider guidance)

### 3. Help panel — Audit Workbook section (`2ab5147`)
New "Audit Workbook" section (5 Q&As):
- What the 3 sheets contain (Audit Review, QBO/Xero Import, Receipts)
- Client sign-off workflow (Track Changes, comment links)
- Excel Copilot prompts for anomaly detection (6 ready-to-paste prompts)
- Google Sheets Gemini prompts (4 prompts)
- Safe columns to add without disturbing the import sheet

### 4. Trial / demo mode (`1468f4c`)
Activated entirely via Render env vars — no source edit needed.

| Env var | Effect |
|---|---|
| `VITE_TRIAL_MODE=true` | Enables all restrictions |
| `VITE_TRIAL_LIMIT=3` | Statement cap (default 3) |
| `VITE_TRIAL_ACCESS_CODE=XXX` | Full-screen gate — blocks app until code entered |

- Full-screen access code gate modal (z-index 9999) — stored in localStorage, seamless re-open
- Processing cap guard in `processOne` reads localStorage directly (no stale-closure risk); re-runs on approved statements don't count
- Counter increments after successful extraction; cap modal auto-shows on last completion
- Trial badge in topbar: amber "N of 3 remaining" → red "Limit reached" + Upgrade link
- Cap modal: "Trial Complete" + mailto upgrade CTA + "continue browsing" (review/export still available)
- `TRIAL_` prefix on all CSV and Audit Workbook filenames in trial mode
- Owner reset: visit `?reset=<code>` to clear trial counter and re-show gate

### 5. Give feedback popover (`c20688c`)
💬 Feedback button in nav, QBO-style popover:
- Textarea + optional email field
- Posts via Formspree (`VITE_FORMSPREE_ID` env var) with `mailto:` fallback if not set
- Success state + disabled Send until text entered

### 6. Zoom demo + accountant trial guide (`25e46e0`)
`docs/DEMO_AND_TRIAL_GUIDE.md` — covers pre-demo checklist, 12-minute demo script with talking points, trial URL sharing with copy-paste privacy note, security Q&A, good practices, and a synthetic demo statement template.

---

## Immediate to-dos — activate features already built

These are configuration steps in Render, not code changes:

### High priority (before first external demo)
- [ ] **Set `VITE_TRIAL_ACCESS_CODE`** on Render → gates the demo behind a code you share privately. Rotate it between demos.
- [ ] **Set `VITE_TRIAL_MODE=true`** on Render → activates trial badge + processing cap.
- [ ] **Sign up for Formspree** (free, formspree.io) → New Form → set `VITE_FORMSPREE_ID` so feedback submissions land in your inbox rather than opening `mailto:`.

### Medium priority (when ready for cloud sync)
- [ ] **Register Google OAuth client** — console.cloud.google.com → follow steps in ☁ Cloud panel → set `VITE_GOOGLE_CLIENT_ID` on Render.
- [ ] **Register Azure app** — portal.azure.com → follow steps in ☁ Cloud panel → set `VITE_MICROSOFT_CLIENT_ID` on Render.

---

## Carried-over issues (from previous sessions, not yet resolved)

### Parser / extraction issues
| Issue | Status | Notes |
|---|---|---|
| Barclays Angeli / Tejada `text=8 vs AI=7` | Unresolved | Text layer over-reads by 1. Likely Barclays "At a glance" summary box creating a spurious cluster. colCount=4 for 7-transaction statements. Non-blocking — count_mismatch badge shows clearly. |
| Catherine Sharp £5.20 variance | Uninvestigated | Small statement (12 transactions, colCount=2 YourFlexAccount). May be opening balance issue. |
| Bank of Scotland 5-page statement | Not re-uploaded | Previous upload was cover page only. Upload all 5 pages. |
| Mansi LLM sign errors | Design limitation | LLM misclassifies `TRAINLINE.COM LONDON` as debit (semantic bias from merchant name). Cannot fix without per-bank prompt. Human sign-flip is the intended path. |

### y-creep fix — confirmed committed
The `groupIntoRows` anchor fix (`14fbd6b`) **was committed and deployed** in a prior session. Not a pending item.

---

## Compliance gate — still PENDING

Per `COMPLIANCE_ASSESSMENT_2026-06-24.md` — required before charging external customers:

- [ ] **JOIC registration** (~£70) — Stephen to self-regulate per ICA qualification
- [ ] **Render DPA** — sign before processing external customer data
- [ ] **Anthropic DPF** — review and confirm
- [ ] **Privacy Policy** — draft required
- [ ] **Customer DPA** — draft required
- [ ] **RoPA** — draft required

**No paid external customers until compliance gate is closed.**
Internal demos and consented trial users are fine in the meantime.

---

## Architecture quick-ref

```
server/
  index.js              Express proxy — LLM + text layer in Promise.all()
  textExtract.js        pdfjs-dist text layer extractor
  crossCheck.js         LLM vs text-layer comparison; count_mismatch / agree / partial
client/src/
  App.jsx               Main UI — canonical source (3,426 lines)
src/
  statement-audit-pro.jsx   Mirror of App.jsx (kept in sync by cp)
docs/
  DEMO_AND_TRIAL_GUIDE.md   Zoom demo script + accountant trial instructions
verify.sh               11-check gate — run before every commit
VERSION                 expected_lines must match wc -l src/statement-audit-pro.jsx
```

**Key env vars (all set in Render → Environment):**

| Variable | Purpose | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | LLM extraction | Set ✓ |
| `VITE_TRIAL_MODE` | Enable trial restrictions | Not set |
| `VITE_TRIAL_LIMIT` | Statement cap (default 3) | Not set |
| `VITE_TRIAL_ACCESS_CODE` | Demo gate code | Not set |
| `VITE_FORMSPREE_ID` | Feedback form delivery | Not set |
| `VITE_GOOGLE_CLIENT_ID` | Google Drive OAuth | Not set |
| `VITE_MICROSOFT_CLIENT_ID` | OneDrive OAuth | Not set |

**Non-negotiables (checked by verify.sh):**
- Model: `claude-sonnet-4-6`, `max_tokens: 32000`
- No assistant prefill
- Robust JSON extractor (indexOf/lastIndexOf)
- UTF-8 BOM on CSV export
- Human-click approval gate — only path to CSV
- API key server-side only
- Deterministic code does arithmetic (no LLM arithmetic)
- One general prompt rule per account type (no per-bank prompt library)
- No real statements committed to git (.gitignore enforced)

---

## Next session candidates

1. Set the three Render env vars above (trial mode, Formspree) — 10 minutes
2. First accountant demo — use `docs/DEMO_AND_TRIAL_GUIDE.md`
3. Barclays Angeli/Tejada extra-transaction investigation (colCount=4 spurious cluster)
4. Catherine Sharp £5.20 variance investigation
5. Bank of Scotland 5-page re-upload test
6. Compliance gate — begin JOIC registration + Privacy Policy draft
