# Phase 8 — Cross-Phase Consistency Audit

**Method:**
- Each check was run by searching the actual files (not from memory), then reviewing the logic by hand.
- Issues were fixed, then the searches were **re-run** (round 2).
- File references are relative to `padcare-assessment/`.

## 1. Audit checklist and results

| # | Check (master prompt / brief) | Round 1 result | Issues | Round 2 |
|---|---|---|---|---|
| 1 | Task 1 and Task 2 use the same lifecycle and step numbers | **Fail** | AU-01 | Pass |
| 2 | Task 2 and Task 3 use the same classifications (4 types + status enquiry; same sub-categories) | Pass | — | Pass |
| 3 | SLA targets consistent everywhere (R1–R6, X1–X4, V1–V4; 24 h HC visit; 5 business days billing; 14-day reopen; 5-day confirmation; 7-day hold) | Pass (numbers); **Fail** (S-01 path text) | AU-07 | Pass |
| 4 | Field validations support the workflow (every T/H requirement exists in the flow) | **Fail** | AU-06 | Pass |
| 5 | Ownership rules consistent (account CS owner from creation; accountable until acceptance; HC operational → Ops City Manager) | **Fail** | AU-05 | Pass |
| 6 | Status transitions valid and identical (state diagram ↔ status table ↔ role matrix ↔ tests) | **Fail** (labels) | AU-02, AU-09 | Pass |
| 7 | Closure rules consistent (evidence by type; confirmation; no-response; reopen) | **Fail** | AU-08 | Pass |
| 8 | Severity rules internally coherent across types | **Fail** | AU-03 (+ F-12 found in Phase 6) | Pass |
| 9 | Terms mean one thing | **Fail** | AU-04 | Pass |
| 10 | Test cases reflect the functional spec (fields, rule IDs, statuses) | Pass | — | Pass |
| 11 | All five scenarios can be handled | Pass (see §3) | — | Pass |
| 12 | All eight challenges addressed | Pass (see `challenges_map.md`; C-1 and C-7 partial by design) | — | Pass |
| 13 | Assumptions disclosed; no invented PadCare capability stated as fact | Pass — the scan for "PadCare/PadCareOne has/holds/uses" found one sentence, sourced from the brief | — | Pass |
| 14 | Brief's negative signals avoided (P1/P2/P3, ITSM jargon, happy path only) | Pass — "P1–P4" appears only as a *rejected* alternative | — | Pass |
| 15 | No stray status names (Under Triage, Resolved, Pending) | Pass | — | Pass |

## 2. Issues found and fixed

| ID | Where | Inconsistency | Why it mattered | Fix |
|---|---|---|---|---|
| **AU-01** | Flow overview, walkthroughs, Challenges Map, traceability | The F-3 "linked tasks" insert renumbered §3.3 → 3.4, but the overview and the walkthroughs still cited "3.3 Accept or return" | A reviewer following step references in Task 2 would land on the wrong section | Overview lists 3.1–3.4; walkthrough acceptance steps cite 3.2; the map cites 3.1–3.4 |
| **AU-02** | Status table, E-8, E-10, analytics, data model | Four vocabularies for closure reasons ("Logged in error" as a reason vs a sub-reason; "No response to information request" vs "No Response") | Metrics M10/M11 and the "valid case" filter would be computed differently by different people | One canonical list: Confirmed · Confirmed on site · Plan Agreed · No Response · Cancelled – Duplicate · Cancelled – Invalid (+ sub-reason). Displayed as `Closed – <reason>` |
| **AU-03** | Flow §2.5 | The "3+ sites" and recurrence escalators applied to all types, so S-05 (multi-site quality trend, no hygiene exposure) would become Hygiene-Critical | Same class of error as F-12: severity stops meaning "hygiene exposure" | Escalators apply to **operational complaints only**; billing escalates (F-12); account-level concerns use their own rule (highest open-case severity, else Service-Impacting) |
| **AU-04** | Flow §2.4, VR-12, M3, walkthrough A | "Recurrence" meant both the link (from the 2nd case) and the escalation flag (from the 3rd); M3 counted ≥ 1 prior while VR-12 fired at ≥ 2 | An interviewer asking "what is your repeat rate?" would get two answers | **Repeat** = 2nd case onwards (link + count; M3). **Recurrence flag** = 3rd case onwards (escalator + root cause) |
| **AU-05** | Phase 1 classification matrix | The operational owner path and the S-01/S-03 paths still said "CS → SE"; F-4 changed Hygiene-Critical cases to Ops City Manager + SE task | Task 1 contradicted its own update | Updated to v1.1 routing |
| **AU-06** | Flow §1.2 | Site mandatory at Log for every type; the spec makes it optional for account-level concerns (S-05 spans sites) | A developer would get two rules | Flow says "site (optional for account-level concerns)" |
| **AU-07** | SLA matrix §E | The illustrative S-01 path said "triage → SE" | Same as AU-05 | "Ops City Manager + SE visit task" |
| **AU-08** | Phase 1 classification matrix | The billing "resolved means" lacked *all affected invoices* (F-8) and the master-data task (D-18) | Closure rule in Task 1 weaker than in Tasks 2/3 | Aligned |
| **AU-09** | Status table | "Confirmed on site" (F-5) missing from the closure reasons | Status the system can set but not display | Added (in the canonical list) |

**Earlier self-found issues** (for the record): F-1 to F-11 (Phase 4 walkthroughs), the Phase 5 reversal of "customer not found → block" (D-34), and F-12 (Phase 6 test design). All are applied or explicitly deferred (F-9 → v2; F-11 → open question).

## 3. Five-scenario check (can every sample complaint run end to end?)

| Scenario | Classification | Intake fields | Routing | Severity / target | Closure | Exceptions | Result |
|---|---|---|---|---|---|---|---|
| S-01 Missed collection | Op / Missed collection (Q4) | 22–26, 44 | HC → Ops City Manager + SE task | HC; X1 24 h | Visit + proof + next visit confirmed; on-site sign-off | Visit shown "Completed"; repeat; rejection | ✓ (walkthrough A) |
| S-02 Invoice / relocated site | Billing / Wrong site-address (Q3) | 27–34 | CS → Finance (+ master-data task) | Service-Impacting (cap); X2 5 business days | All reissued invoices + master task; customer confirms | Unverified site; move after invoice; duplicate | ✓ (walkthrough B, TC-01–06) |
| S-03 Additional unit / overflow | SR / Additional unit (Q5) + linked Op / Overflowing (split) | 35–40, VR-22 | SR → Ops City Manager (+ KAM approval task); OC → Ops City Manager (HC) | SR: committed date (X3); OC: HC 24 h | SR: install record; OC: overflow controlled; separately | Linked complaint declined with a reason | ✓ (design only; not walked) |
| S-04 "Has my complaint been resolved?" | Status enquiry (Q1) | Parent case; VR-09, VR-11 | Parent's communication owner | Inherits; priority + "customer chased" | Never closes the parent | No parent → lost-complaint path; parent closed → reopen/recurrence | ✓ (E-1, TC-06 step 5, TC-09) |
| S-05 Multi-site quality drop | Account-level / Service quality trend (Q2) | 41–43 | KAM (else Ops City Manager, VR-24) | Highest open-case severity, else Service-Impacting (AU-03); X4 meeting ≤ 5 business days | Action plan + review date; Plan Agreed; child cases | No KAM; child cases spawned | ✓ (design only; not walked) |

**Residual weak spot (not an inconsistency):** S-03 and S-05 are validated by design review only, not by a timed walkthrough. Stated in the final document's limitations.

## 4. Open items that remain open by design
- F-9 (automatic next-invoice check) → v2.
- F-11 / A-18 (site master-data owner) → validate with PadCare; default = the city's Ops City Manager.
- Reasoning notes for Tasks 1–3 → **candidate rewrites in their own words** (Q-05, Q-06, Q-07).
