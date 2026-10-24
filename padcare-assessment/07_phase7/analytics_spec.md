# Phase 7 — Analytics Specification

**All metrics are proposed.** PadCare has no structured complaint data today (brief, C-6), so there is no baseline. Targets should be set after 2–3 months of module data.

## 1. Common definitions (apply to every metric)

| Term | Definition |
|---|---|
| **Complaint** | Case with type ∈ {Operational complaint, Billing complaint}. Service requests and account-level concerns are reported **separately**; status enquiries are not cases (they are follow-ups) |
| **Valid case** | closure_reason ∉ {Cancelled – Duplicate, Cancelled – Invalid, Logged in error, Test} |
| **Period attribution** | Volume metrics by **received_at**; resolution and closure metrics by **closed_at**; reopen by the closure cohort |
| **Business time** | Per `SlaPolicy`, net of `hold_started → hold_ended` intervals |
| **City** | The site's city; account-level concerns use the customer's primary_city, or "Multi-city" |
| **Reporting statistic** | Median and P90 for durations (not the mean: a few long cases skew it) |

## 2. Metrics

| # | Metric | Definition (numerator / denominator) | Cut by | Question it answers | Challenge |
|---|---|---|---|---|---|
| M1 | **Case volume** | Count of valid cases received in the period | Type, sub-category, city, customer, site, channel, severity | How much and where? | C-6 |
| M2 | **Category share by city** | Complaints of a sub-category in a city / all complaints in that city (same period) | City × sub-category | "Are 40% of complaints missed services in one city?" (brief's example) | C-6 |
| M3 | **Repeat (recurrence) rate** | Complaints with recurrence_count ≥ 1 at logging (≥ 1 prior same site + sub-category within 90 days) / all complaints received | City, customer, site, sub-category | Are we fixing causes or symptoms? | C-2 |
| M4 | **First response time** | received_at → first `customer_update_sent` with includes_case_ref = true | Severity, channel, CS owner | How fast do customers hear from us? (R3) | C-7 |
| M5 | **Registration delay** | received_at → logged_at; plus the share of cases flagged *Not logged at receipt* | Channel, logger role | Are issues still getting lost or logged late? | C-1 |
| M6 | **Time to resolution** | received_at → first `resolution_recorded`, net of hold | Type × severity, city, owner team | How fast do we fix? (X1–X4) | C-5 |
| M7 | **SLA compliance** | Per target Rx/Xx/Vx: cases meeting it / cases where it applied (valid cases only) | Target, type, severity, city, owner team | Which stage is the bottleneck? | C-4, C-7 |
| M8 | **Time in `Assigned`** and **handoff return rate** | Sum of handoff_initiated → accepted/returned per case; returns / handoffs | Receiving team | Where do handoffs stall? | C-4 |
| M9 | **Ageing by owner** | Open cases by current resolution owner (or team) in age buckets (0–1, 2–3, 4–7, > 7 business days) since received_at, plus open tasks by task owner | Owner, team, city | Who is holding what, for how long? | C-4 |
| M10 | **Customer-confirmed closure rate** | Closed with reason Confirmed / Confirmed on site ÷ all valid closed cases | Type, city, CS owner | Is "closed" really closed? | C-5 |
| M11 | **No-response closure rate** | Closed – No Response / valid closed | Type, city | How often do we close without confirmation? | C-5 |
| M12 | **Reopen rate** | Cases closed in period P that were reopened within 14 days / valid cases closed in P (report P only once 14 days have passed) | Type, sub-category, resolution team | Fix quality | C-5 |
| M13 | **Rejection rate** | Cases with rejection_count ≥ 1 / cases reaching `Awaiting Confirmation` | Type, resolution team | First-time fix | C-5 |
| M14 | **Chase rate** | Open or closed cases with ≥ 1 `followup_received` / valid cases; and follow-ups per case | CS owner, type | Are customers still having to ask? | C-7 |
| M15 | **Silence breaches** | Cases with ≥ 1 R6 breach / open cases in period | CS owner | Are we updating proactively? | C-7 |
| M16 | **Escalation rate** | Cases with ≥ 1 `escalated` / valid cases; by trigger | Trigger, team, city | Where do rules have to force action? | C-4 |
| M17 | **Severity override rate** | Cases where final ≠ system severity / triaged cases; by direction (up / down) and by reporter role | CS user, reporter role | **Is "loudest wins" creeping back?** Overrides that cluster on leadership reporters are the signal | C-8 |
| M18 | **Expedite usage** | Count of expedites by user and customer | User, customer | Same as M17 | C-8 |
| M19 | **Reclassification rate** | Cases with ≥ 1 `reclassified` / triaged cases | From → to type | Are the classification rules clear? | C-3 |

## 3. Worked example — the brief's "40% missed services in one city" question

```sql
-- M2: share of each complaint sub-category within each city, last quarter
SELECT s.city,
       c.sub_category,
       COUNT(*) AS complaints,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY s.city), 1) AS pct_of_city
FROM case_register c
JOIN site s ON s.site_id = c.site_id
WHERE c.case_type IN ('Operational complaint', 'Billing complaint')
  AND c.received_at >= DATE '2025-07-01' AND c.received_at < DATE '2025-10-01'
  AND COALESCE(c.closure_reason, '') NOT LIKE 'Cancelled%'
GROUP BY s.city, c.sub_category
ORDER BY s.city, pct_of_city DESC;
```

Answerable only because city (from site), case_type and sub_category are **structured** and status enquiries are **not** counted as complaints (D-10).

## 4. Data quality risks to these metrics

| Risk | Effect | Control |
|---|---|---|
| Wrong sub-category | M2/M3 distort | Short lists; M19 monitored; quarterly review of "Other" |
| Backdated received_at | M4/M5/M6 look worse or better | received_at edits are logged; > 30 days needs a reason (VR-06) |
| Wrong site / unverified sites | M3 misses recurrences | VR-02/03; unverified site resolved at Triage |
| No-response closures | M10 looks better than reality | Reported separately (M11) |
| Low logging adoption | All volumes understated | M5 *Not logged at receipt* share; channel mix trend |

## 5. Views (only after the data above exists)

| View | Audience | Contents |
|---|---|---|
| **My queue** | CS, Finance, SE, Ops City Manager | Open cases and tasks by computed priority; SLA timers; silence timers |
| **City operations** | Ops City Manager | M1–M3 for the city; M9 ageing; recurrence hotspots (site × sub-category) |
| **Monthly review** | CS/Ops leadership, KAMs | M2, M3, M7, M10, M12, M14, M17; per-account view for KAMs (supports S-05 meetings) |
