# Phase 2 — Proposed SLA Matrix

**All targets are proposals** `[A-07]`. There are no known contractual SLAs. Validate with CS, Ops and Finance before go-live, then calibrate using 2–3 months of data from the module itself.

## Clock rules
- **Hygiene-Critical: calendar hours** (waste accumulates at weekends too). Everything else: **business hours**, 09:00–18:00 Mon–Sat `[A-12]`.
- All clocks start at **received at** (when the customer told PadCare), **not** logged at. Late logging is therefore visible as lost time, and is not hidden.
- Only `On Hold – Customer` pauses a clock. Internal waits never pause it.
- Resolution clocks **do not reset** on rejection. They **restart** on reopen (a reopen is a new resolution attempt; reopen counts are tracked separately).

## A. Response targets (how fast we react) — apply to all case types

| ID | Stage | Measured from → to | Hygiene-Critical | Service-Impacting | Low-Impact / Service request | Why this target |
|---|---|---|---|---|---|---|
| R1 | **Registration** | received → logged | 1 h | 2 business h | 2 business h (SE on site: before leaving the site) | Logging is the C-01 fix; it must happen while the details are fresh. 2 h allows for a CS person on a call |
| R2 | **Triage** (classified, severity set) | logged → triaged | 1 h | 4 business h | 1 business day | Severity cannot be known until triage, so a short target applies to all; Hygiene-Critical is often only discovered *at* triage, so R2 is applied retroactively (see note) |
| R3 | **Acknowledgement** to customer (case ref + next step) | received → first logged update | 2 h | Same business day (≤ 6 business h) | Next business day | The customer must know it was received before they think to chase (C-07). Measured from *received*, so it includes R1 and R2 |
| R4 | **Handoff acceptance** | assigned → accepted/returned | 1 h | 4 business h | 1 business day | The C-04 fix; long enough to read and accept, short enough that nothing sits for days |
| R5 | **First progress update** (plan / ETA) | received → update with ETA | 4 h (visit time confirmed) | 1 business day | 2 business days | Customers chase when they have no ETA, not when work is slow |
| R6 | **Maximum silence** while open | gap between logged customer updates | 1 calendar day | 2 business days | 3 business days (account concern: weekly) | Keeps the customer updated without a portal; S-04 ("no one has updated me") would trigger an R6 breach before the customer had to ask |

*Note on R2 for Hygiene-Critical:* a case logged as Service-Impacting and upgraded at triage is measured against the Service-Impacting R2 target. From the upgrade onwards, Hygiene-Critical targets apply.

## B. Resolution targets (how fast we fix) — by type and severity

| ID | Case type | Hygiene-Critical | Service-Impacting | Low-Impact | Why |
|---|---|---|---|---|---|
| X1 | **Operational complaint** (received → resolution evidence) | **24 h** (corrective visit done) | 3 business days | 5 business days | 24 h is the shortest promise that is realistic for a field visit outside the planned route `[A-08]`. Validate against SE capacity per city |
| X2 | **Billing complaint** | n/a (billing has no hygiene exposure) | 5 business days | 7 business days | Investigation + correction + re-issue across CS → Finance → CS. Long enough for Finance to check service records; short enough to fix the invoice before the next billing cycle |
| X3 | **Service request** | n/a — a linked complaint carries any urgency | **Committed date** agreed at triage (default 10 business days for an installation; 3 for a one-off extra visit) | same | Fulfilment depends on stock and approval; a promised date is more honest than a generic SLA. Measured as "fulfilled by the committed date" |
| X4 | **Account-level concern** | Meeting within 2 business days | Meeting within 5 business days; action plan agreed within 10 business days | Response within 5 business days | Relationship issues need a fast first meeting; the plan needs data gathering (account case history) |

## C. Verification targets

| ID | Stage | Target | Why |
|---|---|---|---|
| V1 | Confirmation request sent | Within 1 business day of resolution evidence (Hygiene-Critical: same day) | Ask while the fix is fresh |
| V2 | Customer confirmation window | 5 business days; reminders at day 2 and 4 → `Closed – No Response` | Avoids cases staying open forever while keeping confirmation the default |
| V3 | Reopen window | 14 calendar days after closure | Covers at least one more service cycle at frequent-service sites; after that it is a recurrence |
| V4 | On Hold – Customer limit | 7 business days, reminders at day 2 and 4 | Same reasoning as V2 |

## D. Escalation timers (from `end_to_end_flow.md` §4.3)

| Trigger | Timer | Escalated to | Decision required within |
|---|---|---|---|
| Handoff not accepted | R4 breached | Receiver's escalation contact | 2 business h (Hygiene-Critical 1 h) |
| Resolution at risk | 75% of X-target used | Owner + CS (alert only) | — |
| Resolution breached | X-target passed | Escalation contact by type | 4 business h (Hygiene-Critical 2 h) |
| Silence breached | R6 passed | CS owner, then CS escalation (city queue) | Same business day |

## E. Illustrative totals (used for consistency in Task 2)

| Scenario | Typical path | Response | Resolution | Confirmation | End to end (illustrative, not PadCare's actual performance) |
|---|---|---|---|---|---|
| S-01 missed collection, Hygiene-Critical | Log → triage → Ops City Manager + SE visit task → evidence → confirm | Ack ≤ 2 h; ETA ≤ 4 h | Visit ≤ 24 h | ≤ 5 business days | ~1 day to fix; closed within ~1 week at most |
| S-02 billing, Service-Impacting | Log → triage → Finance → CS → confirm | Ack same day; ETA ≤ 1 business day | ≤ 5 business days | ≤ 5 business days | ~5 business days to fix; ≤ ~2 weeks to closure |

## Response vs resolution — why they are separate
- Response targets (R1–R6) are about **the customer knowing where things stand**. They are the same for every case type and owned mainly by CS.
- Resolution targets (X1–X4) are about **the problem being fixed**. They vary by type and severity and are owned by whoever holds the case.

A case can meet every response target and still miss resolution, and vice versa. Measuring both separately shows *which* team is the bottleneck.

## To validate with PadCare
1. Is a 24 h corrective visit achievable in every city? (SE capacity, route planning)
2. Finance's invoice correction cycle: is 5 business days realistic? Is there a monthly billing cut-off that should set the target?
3. Working days and hours for CS and field teams (Sundays? holidays?).
4. Service frequency by site type, to calibrate the 3-day missed-collection escalator.
