StatementAudit Pro — Session Handover

Date: 2026-06-17
Changes since last handover: Shipped and live-verified the CR/credit-balance opening fix (account-type-aware balance-marker rule on the credit-card and loan prompts). Confirmed Re-run updates in place (no duplicating bug). Rejected Scribd as a test-data source on data-protection / privacy-positioning grounds; logged a test-data sourcing policy. Item 4 (duplicate detection tuning) is scoped and is the next build. Supersedes STATEMENTAUDIT_HANDOVER_2026-06-16.md.


Headline

The proven Phase-1 credit-card opening-balance issue is CLOSED. HSBC prints the credit-card "Previous Balance" with a "CR" suffix when the cardholder is in credit (overpaid); the model was reading the magnitude and dropping the sign, so a true −£4.31 opening came through as +£4.31 and the statement mis-reconciled by exactly twice the opening. Fixed at the prompt with an account-type-aware rule. Next build is item 4: duplicate detection tuning, now backed by three real, observed scenarios.


How to resume (read this first)

1. Paste this handover as the first message of the new thread.
2. Upload the live statement-audit-pro.jsx (~1,523 lines). Do NOT trust the project's stored copy unless it has been refreshed to this build — the stale-file trap has bitten repeatedly. The stored copy was found two sessions stale earlier today (1,110 lines, max_tokens 8000, still had the removed assistant prefill).
3. Verify at session start in the live file: line count ~1,523; "Last updated: 2026-06-17" header line present; model pinned claude-sonnet-4-20250514; max_tokens 32000; robust indexOf/lastIndexOf parser (no prefill); CR rule present in the credit + loan prompts (grep: "credit-marked balance").


Shipped and live-verified this session: CR / credit-balance opening rule

The fix: added one rule to the credit-card prompt and the loan prompt (both debit-positive account types). On these accounts a balance carrying a credit marker — "CR", "C", or a trailing minus (e.g. "4.31CR", "4.31 CR", "4.31-") — means the cardholder is in credit/overpaid and MUST be returned as a NEGATIVE number. "DR"/"D" or no marker = a normal balance owed, returned positive. Scoped explicitly to the Account Summary balances only, so it does not disturb the transaction-row credit handling (PMT/REF) that already worked.

Why a prompt rule and not code: the opening sign is a reading task (transcribing the CR marker), which the model does reliably. The existing code-side back-solve remains as the graceful fallback if the model ever misses a CR.

Why account-type-aware and not generic: "CR" means the OPPOSITE sign depending on account type. On a current account, CR = in credit = positive (you have money). On a credit card, CR = in credit = the bank owes you = negative (balance owed is below zero). A blanket CR→negative rule would corrupt current accounts. The current/savings prompts already had their own (correct, opposite-polarity) marker rule; the credit-card/loan prompts had none — that gap was the bug.

Verified live: HSBC 09 Nov statement re-run → Opening balance −£4.31 (overdrawn), worked-out closing £200.64 = statement closing £200.64, green "this statement reconciles", no amber banner, no manual click. The 07 June statement (−£6.04) likewise reconciles. The model read the CR correctly on re-run.

IMPORTANT — only takes effect on a fresh process. This is an extraction-prompt change, so already-extracted statements in a session must be Re-run (or re-uploaded) to pick it up. Reloading the app does not re-extract.

State / file: build is now ~1,523 lines with the "Last updated: 2026-06-17" header. No state-shape change this session.


Duplicate-statement puzzle — resolved, not a bug

Mid-session the review showed nearly every row flagged red and "20 possible duplicates". Cause: the session contained duplicate COPIES of whole statements (Stephen had refreshed the app and re-uploaded the same PDFs; the upload handler appends). The detector was correctly noticing that every transaction in one copy had an identical twin in the other copy. Confirmed in code that Re-run updates the statement in place (finds by id, calls updateS) — it does NOT create copies. So: no bug; remove duplicate copies and the flags clear. This is exactly the UX that item 4 should fix at the statement level.


Item 4 — duplicate detection tuning (NEXT BUILD)

Goal: stop the detector treating three distinct situations identically (it currently fires loud red row-level flags for all of them). The three real scenarios observed this session:

1. WHOLE statement loaded twice (every row matches a twin in another loaded statement). Desired: one statement-level warning ("this looks like the same statement as [X] — remove one"), ideally caught at UPLOAD so the session never gets into this state. NOT a sea of red rows.

2. LEGITIMATE same-day repeat within one statement (e.g. two £0.97 JERSEY CAR PARKING rows on 17/10, both real). Desired: soft amber "possible repeat — verify"; must NOT block the green tick. Rationale: if the statement still reconciles with both rows present, they are real (a model double-extraction would unbalance the totals and fail reconciliation + the integrity check anyway).

3. GENUINE partial cross-statement overlap (a few identical transactions across two real, different statements — the Open Banking double-count case). Desired: keep the strong flag. This is the only scenario the current loud treatment actually suits.

Proposed core logic:
- findDupes splits matches into same-statement (same sid) vs cross-statement (different sid), returning two sets instead of one.
- greenLit blocks only on the genuine cross-statement set, not on same-statement repeats.
- Same-statement repeats render as a soft amber "verify" badge, not red, and do not block the gate.
- When an ENTIRE statement's transactions all match another statement, collapse to a single statement-level duplicate warning rather than flagging every row (and consider catching it at upload).

Open scope question to decide in the new thread (do not assume): all three scenarios in one pass, or start with just the same-statement-repeat softening (scenario 2), which is the smallest cut and the most frequent customer irritation? Jason Fried would lean to the smaller cut first.

Non-negotiables to preserve (unchanged): pinned model, max_tokens 32000, robust JSON extractor (no prefill), @/Visa Rate foreign-transaction rule, UTF-8 BOM, mandatory human approval gate. One general rule per account type — no per-bank prompt library.


Decisions locked this session

- Test-data sourcing policy: do NOT use Scribd or similar repositories. They host real individuals' personal bank statements (the "sample" statements seen this session were real people with full account numbers, sort codes, IBANs and addresses). Using them is a data-protection problem (Jersey DPA / UK GDPR) and a direct contradiction of the product's privacy-as-differentiator positioning. Use instead: (a) synthetic statements with known ground truth (the accuracy test plan already has 8; a generator could vary layouts) — these are also the only source with a "correct answer" to measure benchmark accuracy against; (b) Stephen's own or consenting clients' statements (e.g. the HSBC 33); (c) public-authority transparency PDFs (councils/universities publish CORPORATE purchasing-card statements deliberately under transparency law — e.g. the Baildon Town Council Lloyds corporate card PDF). Logged to memory.
- Regex extraction (Python pdfplumber / browser pdf.js scripts offered) rejected: it is the OCR/regex path the product deliberately avoids, it would not even fix the CR bug (it parses transaction rows, not the Account Summary balance line), and a per-bank regex zoo is unmaintainable for a solo dev. Stay with Claude native PDF reading.
- Privacy guarantee is a standalone-deployment property. In the artifact, statements pass through the Claude API; the full "data never leaves your environment" promise depends on controlled infrastructure. Keep front of mind as the privacy positioning firms up.


Backlog / edge cases logged this session (not for the item-4 pass)

- Two-date credit-card layouts ("Received By Us" vs "Transaction Date") — confirm the TRANSACTION date is the one landing in extracted rows (QBO/Xero want transaction date, not posting date). Spot-check.
- Credit-marker placement variants: Santander prints "CR" BEFORE the amount ("CR £1,940.00") on the payments line — current rule handles trailing markers; watch leading placement.
- Overdraft markers on current accounts ("OD", "CD", "D") in mixed layouts.
- Foreign-currency transaction lines (e.g. AIB RON@rate, Barclays INR with VISA Exchange Rate) — preserve GBP amount, classify VIS, never drop.
- Multi-transaction-per-date layouts (several rows sharing one date / one end-of-day balance).
- High "possible missing statements" / short-period counts seen earlier — period dates may be read as the transaction span rather than the full statement month. Investigate separately.


Housekeeping

- Refresh the stored project copy of statement-audit-pro.jsx to this 1,523-line build (done this session — confirm it landed), or commit to uploading the live file each new thread.
- Deprecated bank-statement-audit__1_.jsx still flagged for deletion — confirm with Stephen before removing.


Standing session rules (reminder)

Plan first · verify in the live artifact, not just a harness · separate proof from guess (state a cause as fact only when proven by arithmetic or verified in the running app; label hypotheses) · human gate is non-negotiable · flag assumptions one at a time · minimum change · capture lessons · plain language · always advise and confirm before any file save or delete · never persist real personal bank details to memory.
