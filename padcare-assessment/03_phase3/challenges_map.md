# Phase 3 — Challenges Map

Step references (e.g., 2.5, R6) point to `02_phase2/end_to_end_flow.md` and `sla_matrix.md`. Coverage: ● fully addressed in v1 · ◐ partly (limitation stated).

## A. Challenges Map (document version — goes at the top of the submission)

| # | Challenge (brief) | Design choice that addresses it | Where in the design | Coverage |
|---|---|---|---|---|
| 1 | Complaints lost between channels | **Whoever receives an issue logs it**, from any of the 6 channels, in a 2-minute Log step. The case is **owned by the account's CS owner from the moment it is logged**, or by the city CS queue if that person is on leave. A status enquiry about an issue with no case exposes the loss (flag *Not logged at receipt*) | 1.1, 1.2, 2.2 · R1 | ◐ |
| 2 | Repeat vs new unknown | **Related-record panel shown before classification** (open cases + same site/category in 90 days). The **3rd case in 90 days is marked "Recurrence"**, raises severity one level, and needs a root-cause note to resolve | 2.1, 2.4, 2.5, 4.1 | ● |
| 3 | Requests, status checks, account concerns all called "complaints" | **4 case types** with their own owner, path and closure evidence, chosen by **5 ordered questions**. **A status check is not a case**; it is attached to its parent. Mixed messages are **split into linked cases** (S-03) | 2.2, 2.3 · Phase 1 matrix | ● |
| 4 | No clear handoff between teams | **Formal handoff:** reason + required-info checklist + due time. **The sender stays accountable until the receiver accepts or returns it**; non-acceptance escalates. CS remains the **communication owner** throughout | 3.1, 3.2, 4.3 · R4 | ● |
| 5 | "Resolved" ≠ resolved | **Resolution evidence required by type** (visit proof, invoice/credit note no., install record, action plan) before **Awaiting Confirmation**. Closure needs the customer's confirmation or a defined no-response rule. Rejection reopens the case; a recurrence within 14 days reopens it | 4.1, 5.1–5.4 · V1–V3 | ● |
| 6 | Can't see patterns | **Structured fields** (city, site, customer, type, sub-category, severity, channel) and an **event log** for every status, owner and customer update. This enables, e.g., "% of missed-service complaints by city last quarter" | ST6 · Phase 7 metrics | ● |
| 7 | Customer has no visibility | **CS sends updates at fixed points** (acknowledgement with case ref, ETA, any ETA change, resolution) plus a **"maximum silence" timer** per severity. Status enquiries are counted per case, so chasing is measured | 2.6, 5.1 · R3, R5, R6 | ◐ |
| 8 | Severity by who shouts loudest | **Severity proposed by the system from impact answers** (hygiene exposure now? sites affected? commitment broken?) plus automatic escalators (recurrence, 3+ sites, overdue days). **Seniority, tone and revenue are not inputs.** Overrides need a reason; Expedite use is reported | 2.5 | ● |

### Limitations stated honestly (◐ rows and residual risks)

| # | Limitation | Mitigation / v2 |
|---|---|---|
| 1 | Still relies on people logging; nothing stops a CS person answering on WhatsApp and never logging it | Lost issues become **visible and counted** when customers chase. v2: capture from the support inbox and WhatsApp Business directly |
| 2 | Detection depends on the correct site and sub-category being chosen. "Bad odour" logged as "unit not cleaned" won't match | Sub-categories kept short; category-agnostic "all open cases at this site" panel; reclassification tracked |
| 3 | Deciding whether a need is "independent" (split rule) is a judgement call | Worked examples in training; reclassification rate reviewed |
| 4 | Escalation only works if escalation contacts act | Their decision time is measured (4.3) |
| 5 | A customer who never replies is closed "No Response", so some unresolved issues close | Excluded from the confirmed-closure rate; 14-day reopen window; SE confirmation on the next visit |
| 6 | Data is only as good as classification at triage | Ordered questions + reclassification tracking; review the categories after 3 months |
| 7 | **No customer self-service in v1** (PadCareOne is internal). Visibility depends on CS discipline | R6 breaches are tracked. v2: read-only status link by case reference |
| 8 | Thresholds (3 days overdue, 3 sites, 3rd in 90 days) are proposals, not validated | Calibrate after 2–3 months of module data; downgrade overrides are reviewed |

## B. Stage × challenge coverage (working view)

| Stage / step | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|---|
| 1.1 Who logs by channel | ● | | | | | | | ● (KAM logs; seniority recorded but not used) |
| 1.2 Log + owner from creation | ● | | | ● | | ● | | |
| 1.3 Validate customer/site | | ● (correct site makes the history usable) | | | | ● | | |
| 2.1 Related-record panel | | ● | | | | | | |
| 2.2 Ordered classification; status enquiry → parent | ● (lost-case flag) | | ● | | ● (enquiry never closes the parent) | ● | ● (chase count) | |
| 2.3 Duplicate / split | | ● | ● | ● (separate owners) | | ● | | |
| 2.4 Recurrence | | ● | | | | ● | | ● |
| 2.5 Severity + priority | | ● | | | | ● | | ● |
| 2.6 Acknowledge | | | | | | | ● | |
| 3.1–3.3 Routing + handoff protocol | | | | ● | | ● | | |
| 4.1 Evidence by type | | ● (root cause for recurrences) | | | ● | | | |
| 4.2 On Hold – Customer only | | | | ● | | | | |
| 4.3 Escalation | | ● | | ● | | | | ● (escalation by rules, not influence) |
| 5.1–5.4 Confirmation, close, reopen | | ● | | | ● | | ● | |
| ST6 Events | | | | | | ● | ● | ● (override reporting) |

Every challenge is addressed by at least two steps. No step exists without a challenge it serves.

## C. Expected operational benefit (qualitative; no PadCare baseline exists to quantify against)

| # | Benefit |
|---|---|
| 1 | No issue depends on one person's phone; leave cover is automatic |
| 2 | The 3rd odour complaint is handled as a pattern, with Ops City Manager involvement, not as fresh |
| 3 | Finance only sees billing; Ops only sees operational work; KAMs see account concerns; complaint metrics are not inflated by status checks |
| 4 | Every billing complaint has a named holder at every moment; "days in Finance" becomes a number |
| 5 | "Closed" means confirmed; reopen rate shows fix quality |
| 6 | Questions like "40% missed services in one city" become a report, not an investigation |
| 7 | Fewer "any update?" messages; chasing becomes a measured failure, not routine |
| 8 | A polite report of a hygiene risk at a large account outranks a loud cosmetic complaint, by rule |
