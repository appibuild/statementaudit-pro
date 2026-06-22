# Demo-Company Import Steps — Sample Files

**Date:** 2026-06-21 · A hands-on aid, not a build doc. Goal: feel the difference between QuickBooks' one CSV door and Xero's two doors, with fake data, in safe practice companies. Nothing here touches real books.

Three sample files (5 fake transactions each, DD/MM/YYYY, no real data):
- `QBO_native_sample.csv` — Date, Description, Amount (what QuickBooks' bank upload actually accepts)
- `Xero_plain_sample.csv` — Date, Amount, Payee, Description, Reference (Xero's standard import)
- `Xero_precoded_sample.csv` — the above **plus an Account Code column** (Xero's pre-coded import)

---

## A. QuickBooks Online — the single plain door

**Practice company:** the QuickBooks Test Drive sample company (free, no sign-up, resets on logout — nothing saves).
- Open an **incognito/private** browser window (stops it redirecting to your real QBO).
- Go to `https://qbo.intuit.com/redir/testdrive`, pass the security check. You're now in the sample company "Craig's Design and Landscaping."

**Import `QBO_native_sample.csv`:**
1. Left menu → **Transactions → Bank transactions** (older layouts: **Banking**).
2. Pick any bank account tile (or **Link account ▾ → Upload from file**).
3. **Upload from file** → choose `QBO_native_sample.csv` → **Continue**.
4. Choose the account to import into → **Continue**.
5. **Map the columns:** Date → Date, Description → Description, Amount → Amount. **At the date-format step, choose DD/MM/YYYY** (the sample uses UK dates).
6. Confirm income is positive / expenses negative in the preview → finish.

**What to notice:** the lines land in **For Review** with just date, description and amount. There's **no payee and no category yet** — you'd assign those here, or via bank rules. That's QuickBooks' design: the CSV brings the figures, you code afterward. (Try adding a 6th column of "account codes" to the file and re-importing — QBO ignores it or errors. That's the point: the native door won't carry coding.)

---

## B. Xero — two doors, side by side

**Practice company:** Xero's built-in Demo Company (free, fictional data, resets every 28 days or on demand).
- Log in to Xero → click your **organisation name** (top-left) → **My Xero**.
- Scroll to the bottom of the organisation list → **Try the demo company**. (If you want UK data/codes, set the demo country to United Kingdom via **Change Country or Edition**.)

### Door 1 — plain import (`Xero_plain_sample.csv`)
1. **Accounting → Bank accounts** → on any account click **Manage Account → Import a Statement**.
2. Select `Xero_plain_sample.csv` → **Next**.
3. Map columns (Date, Amount, Payee, Description, Reference), confirm DD/MM/YYYY → import.
4. Open the account's **Reconcile** tab.

**What to notice:** the lines arrive with payee and description, **but no account/category** — you still pick the account for each on the Reconcile screen (or let bank rules do it). Same as QuickBooks: figures in, coding still to do.

### Door 2 — pre-coded import (`Xero_precoded_sample.csv`)
1. Same path, but choose **Import a precoded statement** (Accounting → Bank accounts → Manage Account → there's a separate pre-coded import option).
2. Select `Xero_precoded_sample.csv` → map the extra **Account Code** column → import.

**What to notice:** this time the transactions arrive **already coded** to the account codes in the file — the categorisation is done *before* you reconcile. **This is the door StatementAudit Pro's pre-coded Xero export (Job 1) targets**, and it's the whole "finished before you open the books" idea made real.

> **Account-code caveat:** the codes in the pre-coded sample (429, 200, 445, 461, 404) are common Xero defaults but may not all exist in your demo company's chart. If Xero flags an unknown code, either swap it for one that exists in **Accounting → Chart of accounts**, or add the code. This is also true in production — the codes we export must match codes that exist in the client's chart.

---

## The takeaway you'll feel

- QuickBooks: one door, figures only, code afterward.
- Xero: a plain door (same as QuickBooks) **and** a pre-coded door where the coding rides in with the file.

That asymmetry is exactly why the build plan is "Xero gets both files now; QuickBooks gets the plain file now and the pre-coded experience later via the direct connection." Once you've watched the pre-coded Xero import land already-categorised, the decision stops being abstract.
