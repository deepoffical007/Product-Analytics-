# Phase 6 — Requirements Traceability (tests ↔ requirements ↔ rules)

## A. Test → requirement → rule → design step

| Test | Brief / challenge requirements | Validation rules | Design steps | Findings verified |
|---|---|---|---|---|
| TC-01 | T3-01, T3-02, C-1 (owner from creation), C-3 (classification), C-8 (impact severity), S-02 | VR-05, VR-07, VR-08, VR-17 | 1.2, 1.3, 2.2, 2.5, 3.1 | F-1 |
| TC-02 | T3-01, T3-02, C-4 (complete handoff), S-02 | VR-13, VR-15, VR-31 | 2.5, 3.2 | F-7 |
| TC-03 | T3-05 (wrong site/customer), C-2/C-6 (data quality), S-02 | VR-02, VR-03 | 1.3, 3.3 (tasks) | F-3, F-11 |
| TC-04 | T3-04 (repeat complaint), C-2, D-14 | VR-11, VR-12 | 2.1, 2.3, 2.4, 2.5 | **F-12** |
| TC-05 | C-4, T1-03 | VR-27, VR-31 | 3.2, 3.4, 4.3 · R4 | F-2 |
| TC-06 | C-5, T1-05, T3-03 (status check does not close the parent), S-04 pattern | VR-09, VR-27, VR-33 | 4.4, 5.1–5.3, E-1 | F-3, D-16 |
| TC-07 | C-5 (non-response) | — (timer) | 5.2 · V2 | D-24 |
| TC-08 | C-5 (rejection) | — | 5.2, 4.3 | — |
| TC-09 | C-1, T3-03 | VR-06, VR-09 | 2.2, E-1 | — |
| TC-10 | Exception: invalid attachment | VR-25 | E-6 | — |
| TC-11 | C-3 (reclassification) | VR-32 | 2.2 | — |

## B. Rule → test coverage (gaps shown)

| Rule | Covered by | Rule | Covered by |
|---|---|---|---|
| VR-01 | — (gap: unmatched customer) | VR-18 | — (S-01 only; out of billing scope) |
| VR-02 | TC-03 | VR-19 | — (operational / SR) |
| VR-03 | TC-03 | VR-20 | — (S-01 only) |
| VR-04 | — (gap) | VR-21 | — (gap: override reason) |
| VR-05 | TC-01 | VR-22 | — (S-03 only) |
| VR-06 | TC-09 | VR-23 | — (S-03 only) |
| VR-07 | TC-01 | VR-24 | — (S-05 only) |
| VR-08 | TC-01 | VR-25 | TC-10 |
| VR-09 | TC-06, TC-09 | VR-26 | — (gap) |
| VR-10 | — (gap: linking a parent from another customer) | VR-27 | TC-05, TC-06 |
| VR-11 | TC-04 | VR-28 | — (gap) |
| VR-12 | TC-04 (B) | VR-29 | — (gap) |
| VR-13 | TC-02 | VR-30 | — (SE only) |
| VR-14 | — (gap: future invoice month) | VR-31 | TC-02, TC-05 |
| VR-15 | TC-02 | VR-32 | TC-11 |
| VR-16 | — (gap: Wrong amount sub-category) | VR-33 | TC-06 |
| VR-17 | TC-01 | VR-34 | — (gap) |

**Coverage:** 17 of 34 rules are exercised by the billing test set.
- **7 are out of scope by design** (VR-18, 19, 20, 22, 23, 24, 30). They are specific to S-01, S-03, S-05 or SE logging, and the brief asks for tests on one complaint.
- **10 billing-relevant gaps** (VR-01, 04, 10, 14, 16, 21, 26, 28, 29, 34) would be added in a full test plan.

None of the gaps affects the six document test cases.

## C. Finding raised by test design

| ID | Found while writing | Problem | Fix (v1) |
|---|---|---|---|
| **F-12** | TC-04 variant B | The recurrence escalator raises severity one level, capped at Hygiene-Critical. A 3rd billing complaint would therefore become **Hygiene-Critical**, which is meaningless for billing and has no X2 target | Severity escalators **cap at Service-Impacting for billing**. A billing recurrence instead triggers **escalation** (Finance escalation contact + KAM informed). Applied in `end_to_end_flow.md` §2.5 † and the VR-12 text |
