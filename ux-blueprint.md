# StatementAudit Pro — UX/Design Blueprint

Canonical design reference. Updated after every design session.  
**If the JSX is ever rolled back, rebuild from this file.**

---

## Design System Rules (established 2026-07-01)

Source: user methodology brief ("Visual Audit & Segmented Refactor Method").

1. **8px spacing rhythm** — use 4 / 8 / 16 / 24 / 32 / 48px only. No 10/15/20px.
2. **JetBrains Mono (`C.fontData`) for all financial figures** — amounts, balances, dates, codes.
3. **`tabular-nums`** on every numeric column — use `...C.num` spread on any element showing amounts/balances.
4. **Right-aligned** amount/balance columns in all tables.
5. **White card surfaces** (`C.card = #FFFFFF`). Never use a saturated colour as a page background.
6. **Slate borders** (`C.bdr = #E2E8F0`, `C.bdrBrt = #CBD5E1`) — cool blue-gray, matching QuickBooks Online.
7. **10% opacity tints** for status backgrounds — use `C.grnDim`, `C.ambDim`, `C.redDim`, `C.bluDim`.
8. **No new components or external packages** — all changes via `C` token block or inline `style={{}}`.
9. **QuickBooks Online spacing** applied site-wide (not just Help panel).

---

## C Token Block — Current State

```js
const C = {
  // Backgrounds
  bg:'#F4F5FA',       // page canvas
  surf:'#F8FAFC',     // raised surface / input fill
  card:'#FFFFFF',     // card / panel surface
  cardHov:'#F8F9FE',  // card hover

  // Borders
  bdr:'#E2E8F0',      // default border (QBO slate)
  bdrBrt:'#CBD5E1',   // medium border / divider

  // Status — green
  grn:'#0FA968', grnDim:'#E6F7EF', grnBrd:'#BCE6D2',
  // Status — amber
  amb:'#D9870B', ambDim:'#FCF3E1', ambBrd:'#F2D79E',
  // Status — red
  red:'#DC4646', redDim:'#FBEBEB', redBrd:'#F1C5C5',
  // Status — blue (primary)
  blu:'#2D6FF0', bluDim:'#EAF1FE', bluBrd:'#C2D8FB',
  // Status — purple (loan/mortgage)
  pur:'#7A5AF0', purDim:'#EEEAFD', purBrd:'#D2C7F7',

  // Text scale
  t1:'#0F1B2D',   // headings / primary
  t2:'#475467',   // body
  t3:'#606B78',   // secondary / labels (WCAG AA on white)
  t4:'#C8D0DC',   // placeholder / muted

  // Shadows
  sh1:'0 1px 4px rgba(15,27,45,0.06)',
  sh2:'0 4px 16px rgba(15,27,45,0.08)',
  sh3:'0 8px 32px rgba(15,27,45,0.13)',

  // Platform brand colours
  xero:'#13B5EA',
  qbo:'#2CA01C',
  google:'#4285F4',
  microsoft:'#0078D4',

  // Typography
  fontUI:  'Plus Jakarta Sans, system-ui, sans-serif',
  fontData:'JetBrains Mono, monospace',

  // Numeric shorthand — use ...C.num on any element displaying amounts/balances
  num: { fontFamily:'JetBrains Mono, monospace', fontVariantNumeric:'tabular-nums' },
};
```

---

## Spacing Scale (8px rhythm)

| Token | Value | Use |
|---|---|---|
| 4px  | `C.sp.xs` | icon gap, tight inline |
| 8px  | `C.sp.sm` | row padding, small gap |
| 16px | `C.sp.md` | card padding (compact) |
| 24px | `C.sp.lg` | card padding (standard) |
| 32px | `C.sp.xl` | section gap |
| 48px | `C.sp.xxl` | page top margin |

> Not yet in C block — add `sp:{xs:4,sm:8,md:16,lg:24,xl:32,xxl:48}` when doing a spacing sweep.

---

## Border Radius Scale

| Use | Value |
|---|---|
| Badge / pill | 4px |
| Button / input | 8px |
| Card | 10–12px |
| Modal / panel | 16px |

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Left Sidebar (220px collapsed→56px)                    │
│  ├─ Brand mark (£ logo + app name)                      │
│  ├─ [Section] File / Project (collapsible)              │
│  └─ [Section] Statements (scrollable list)              │
├─────────────────────────────────────────────────────────┤
│  Main area                                              │
│  ├─ Tool bar (top-right, 42px, QBO style)               │
│  │   ☁ Cloud | ⧖ Activity | ? Help | 💬 Feedback |     │
│  │   💡 Guide | ⌨ Keys                                  │
│  ├─ Page title bar (46px, horizontal workflow tabs)     │
│  │   ⌂ Home | 1 Upload › 2 Process › 3 Review ›        │
│  │   4 Export › ◈ Projects          [💡 Page guide]     │
│  └─ Content area (padding 0 for dash/home, 12/18px)     │
└─────────────────────────────────────────────────────────┘
```

**Responsive breakpoints:**
- `isTablet = windowWidth < 1024` — reduced padding, condensed labels
- `isNarrow = windowWidth < 840` — icon-only toolbar, single-column grids

---

## Feature Checklist

### Layout & Navigation
- [x] Collapsible left sidebar (220px ↔ 56px), auto-collapses at 1024px
- [x] File/Project section (collapsible)
- [x] Statements section (scrollable)
- [x] Workflow tabs in horizontal page title bar
- [x] Top-right toolbar (QBO style)
- [x] Home tab as default landing
- [x] Page guide pill inline with page title

### Help System
- [x] Help link inline with each page title (guide pill)
- [x] Help sub-sections always expanded (not collapsed)
- [x] Help sub-sections match Main Help design format
- [x] Import steps accessible via Help quick links (Export page)
- [x] Xero + QBO instructions merged into single Help section

### Responsive
- [x] Tablet layout (< 1024px)
- [x] Narrow layout (< 840px)
- [x] Sidebar auto-collapses on tablet

### Design Tokens
- [x] C.fontUI = Plus Jakarta Sans
- [x] C.fontData = JetBrains Mono (applied to 48 locations)
- [x] C.xero, C.qbo brand colours
- [x] C.t3 darkened to #606B78 (WCAG AA)
- [x] **C.num spread (`...C.num`) on all amount/balance cells** — tabular-nums (47 locations)
- [x] **C.google (#4285F4), C.microsoft (#0078D4)** added to C and applied in cloud provider UI
- [x] **C.bdr updated to #E2E8F0** (QBO accurate slate)
- [x] **C.bdrBrt updated to #CBD5E1**
- [x] **C.surf updated to #F8FAFC**
- [x] **Amount columns right-aligned** in transaction table (textAlign:right on debit/credit/balance)

### Compliance (applied 2026-07-01 commit 18e16db)
- [x] dangerouslySetInnerHTML removed
- [x] OAuth token → sessionStorage
- [x] CSP + Referrer-Policy in index.html
- [x] Trial bypass removed
- [x] Blob URL revoke on download
- [x] Stale Inter font useEffect removed
- [x] noopener on window.open
- [x] aria-labels on symbol buttons
- [x] scope="col" on table headers
- [x] Index-as-key replaced with stable keys
- [x] Personal email → support@statementaudit.pro

### Landing Page (commit 18e16db)
- [x] Two Pathways section
- [x] Who This Supports
- [x] What You Get (6 benefit cards)
- [x] Compliance & Data panel
- [x] Data Saving Warning (amber panel)
- [x] Quickstart (4 step cards)

### Demo Data (commit e7ff67b)
- [x] HSBC Business Mar 2024 (12 txns, approved)
- [x] Barclays Personal Feb 2024 (8 txns, review, 1 flagged)
- [x] Starling Business Jan 2024 (10 txns, approved)

---

## Completed Design Work (all items resolved 2026-07-02)

- [x] **Tabular-nums sweep** — `...C.num` on all amount/balance/figure elements (commit 7ed96a0)
- [x] **Amount column right-alignment** — `textAlign:'right'` on debit/credit/balance columns
- [x] **Border colour sweep** — `bdr:#E2E8F0`, `bdrBrt:#CBD5E1`, `surf:#F8FAFC`
- [x] **Google/Microsoft tokens** — `C.google:'#4285F4'`, `C.microsoft:'#0078D4'` (fixed self-ref bug in 34cbce3)
- [x] **Spacing rhythm audit** — all gap/margin/padding values aligned to 4/8/16/24/32/48px (commit 34cbce3)
- [x] **QBO-style statement cards** — border-radius normalised (badge:4, button/input:8, card:10-12, modal:16); sidebar item padding:8px; export stat cards borderRadius:12 (commit 34cbce3)

## Pending Design Work

*None — all design system items resolved as of 2026-07-02.*

---

*Last updated: 2026-07-02 — complete design system shipped. C.google self-reference bug fixed. Full 8px rhythm enforced across 580 changed lines.*
