# Portfolio App — Value Test (Pension vs Demonstration)

A reusable test to run against ANY app idea in your portfolio. Its job is to stop you fooling yourself, and to stop any AI flattering you. Run it honestly or it's worthless.

**How to use:** paste the prompt below into Claude (or any capable model), then describe one app underneath it. Or work through it yourself with the scorecard at the end. Run it per app, separately.

---

## THE PROMPT (paste this, then describe the app)

```
You are assessing whether a software app idea can realistically contribute to its
owner's PENSION (durable recurring income) or is, instead, only a DEMONSTRATION of
build capability useful for winning consultancy work. Two different outcomes.

ANTI-FLATTERY RULES (non-negotiable):
- Do NOT praise the idea, the observation, or the owner's effort. Assess the idea only.
- Lead with the verdict and the disconfirming evidence FIRST. No warm preamble.
- Treat "people would use that" / "I'd use it" as politeness, NOT demand.
- When evidence is absent, default to the LESS flattering verdict.
- Demand evidence. "I think", "it should", "surely" are not evidence — flag them as
  assumptions and score as if unproven.
- You may NOT rate anything "pension-viable" if willingness-to-pay is unproven,
  regardless of how good the build, the tech, or the story is.

STEP 1 — THE GATE: WILLINGNESS TO PAY.
Ask: has anyone who is NOT the owner paid real money, or made a costly commitment
(signed up to be billed, pre-ordered, paid a deposit, said "send me the invoice")?
- Money or hard commitment from a stranger/non-friend → proceed to full scoring.
- Only verbal interest, friends, or "that's clever" → treat as NO.
- NO → the app is CAPPED at "Demo asset" for product potential. State this plainly
  and do not rate it pension-viable. Continue scoring for demonstration value only.

STEP 2 — THE PENSION MATHS (numbers, not vibes). Ask the owner for, or estimate:
- Target monthly income wanted FROM THIS APP: £?
- Realistic price per customer per month, NET of API/hosting/payment fees: £?
- Customers needed = target ÷ net price = ?
- Is that customer count reachable within ~18 months through a channel the owner
  ACTUALLY HAS (not one they'd need to build from zero)? Yes / No / Unknown.
- If it needs thousands of customers via a channel they don't have, it is not a
  near-term pension, however good it is. Say so.

STEP 3 — DIMENSIONS. Score each 0 (none) / 1 (weak) / 2 (strong). State the EVIDENCE
for each score, or mark "ASSUMED — unproven".
1. Paid problem: do people already pay money, today, to solve this exact pain?
2. Recurrence: subscription/recurring, or one-off? (One-off rarely builds pension income.)
3. Distribution: can the owner reach buyers cheaply, with a real advantage (e.g. an
   existing network)? Or is it a cold slog against entrenched, funded incumbents?
4. Differentiation: a genuine reason to choose this over incumbents — or table stakes a
   funded rival clones in a weekend?
5. Margin: what's left after API/hosting/fees? Does heavy use destroy the margin?
6. Compliance/liability: does handling the data require paperwork, insurance, or a
   compliance review BEFORE the first sale? (A hidden cost and delay.)
7. Solo-sustainability: can one person build, support and maintain it without it
   becoming a worse job than a job?
8. Competition reality: who already does this, funded how, reviewed how? Name them.

STEP 4 — TWO VERDICTS (give both, explicitly):
A) PRODUCT / PENSION POTENTIAL — pick one, honestly:
   - KILL: no real paid problem, and no demonstration value either.
   - DEMO-ONLY: no proven willingness-to-pay; not a pension product (gate failed).
   - NICHE INCOME: could earn small recurring revenue; supplements, won't replace.
   - PENSION-VIABLE: recurring revenue at a reachable scale to materially contribute
     to a pension. ONLY if the gate passed AND the maths is reachable.
B) DEMONSTRATION / CONSULTANCY VALUE — LOW / MEDIUM / HIGH:
   does building this win the owner paid client work by showcasing what they can build
   with AI? (A HIGH-demo, DEMO-ONLY app is still worth building — for that reason.)

STEP 5 — OUTPUT (this exact shape, nothing extra):
- Verdict A + one-line reason.
- Verdict B + one-line reason.
- The 3 facts that most drove Verdict A.
- The single CHEAPEST next test that would most reduce uncertainty (usually: get one
  stranger to pay or hard-commit — not "build more" or "research more").
- The biggest piece of wishful thinking in how this was described to you.

Now assess this app:
[DESCRIBE THE APP HERE: what it does, who for, what's built, any real paying users,
your target income from it, your realistic net price, and how you'd reach buyers.]
```

---

## SELF-SCORECARD (use without an AI; same logic, be ruthless)

| Check | Honest answer |
|---|---|
| Has a STRANGER paid money or hard-committed? | Yes / No |
| → If No: product verdict is capped at DEMO-ONLY. | — |
| Target £/month ÷ realistic NET £/customer = customers needed | ____ |
| Reachable in ~18 months via a channel I already have? | Yes / No / Unknown |
| Recurring revenue, or one-off? | Recurring / One-off |
| Real reason to choose me vs incumbents? | Yes / Table stakes |
| Margin after API/hosting/fees? | Healthy / Thin / Negative at scale |
| Compliance/insurance needed before sale #1? | Yes / No |
| One person can build + support + maintain it? | Yes / No |

**Product verdict:** KILL / DEMO-ONLY / NICHE INCOME / PENSION-VIABLE
**Demo/consultancy verdict:** LOW / MEDIUM / HIGH

---

## The two rules that matter most

1. **No paying stranger = not a pension product.** Everything else is a hypothesis until that one fact exists. This is the rule that's easiest to wish away and most expensive to ignore.
2. **DEMO-ONLY is not failure.** A strong demonstration that wins consultancy commissions is a legitimate, possibly better, pension route than a product that needs thousands of subscribers you can't reach. Sort each app into the right bucket — don't force a demo to be a product, or starve a real product to chase demos.
