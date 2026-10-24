# Phase 8 — Final Requirements Traceability

Requirement IDs come from `00_phase0/requirements_matrix.md`. "Doc §" = the planned section of the final document (Phase 9 outline).

**Status values:**
- **Verified** — content exists and passed the audit.
- **Pending P9** — produced at document assembly.
- **Candidate** — needs your own words.

| Req | Requirement (short) | Where it is met (working files) | Doc § | Status |
|---|---|---|---|---|
| G-01 | One Word/PDF doc, all 3 tasks, diagrams | Phase 9 | all | Pending P9 |
| G-02 | Assumptions section at the top | `assumptions_register.md` (A-01…A-21) | §2 | Pending P9 (content Verified) |
| G-03 | Challenges Map at the top | `03_phase3/challenges_map.md` §A | §3 | Verified |
| G-04 | Reasoning note 3–6 lines per task | `task1_reasoning.md` §C; end of `task2_walkthroughs.md`; `intake_form_spec.md` §5 | §4.4, §5.3, §6.6 | **Candidate** |
| G-05 | Anchored in the 8 challenges / 5 complaints | Every decision tagged C-x / S-x (decision log) | all | Verified |
| G-06 | Concise; diagrams over prose | Phase 9 page target 8–12 | all | Pending P9 |
| G-07 | Assumptions stated inline | `[A-xx]` tags in all phases | all | Verified |
| G-08 | No generic ITSM / P1-P3 | Audit check 14 | — | Verified |
| G-09 | Not only the happy path | Lifecycle exceptions; E-1…E-10; ⚠ walkthrough paths; negative tests | §4, §5, §6 | Verified |
| G-10 | Internal consistency | This audit (AU-01…AU-09 fixed) | — | Verified |
| G-11 | "What I finished" note if incomplete | Not needed if complete | — | n/a |
| G-12 | Defensible in the walkthrough | Phase 10 | — | Pending P10 |
| C-01 | Lost between channels | Flow 1.1–1.2, 2.2 (lost-case flag); R1; M5 | §3, §4 | Verified (partial by design) |
| C-02 | Repeat vs new | 2.1, 2.4 (AU-04), VR-11/12, TC-04; M3 | §3, §4, §6 | Verified |
| C-03 | Types mixed | Classification matrix; 2.2–2.3; field 16–21 | §3, §4.1 | Verified |
| C-04 | Handoffs | 3.2–3.4, 4.3; R4; TC-05; M8/M9 | §3, §4 | Verified |
| C-05 | Premature closure | 4.4, 5.1–5.4; VR-33; TC-06; M10–M13 | §3, §4, §6 | Verified |
| C-06 | Patterns | ST6; `data_model.md`; `analytics_spec.md` M2 + SQL | §3, §7 | Verified |
| C-07 | Customer visibility | 2.6; R3, R5, R6; M14/M15 | §3, §4 | Verified (partial by design) |
| C-08 | Loudest wins | 2.5 (AU-03); field 14 note; VR-21/28; M17/M18 | §3, §4 | Verified |
| S-01 | Missed collection | Classification; walkthrough A; VR-18/20 | §4.1, §5.1 | Verified |
| S-02 | Billing / relocated site | Classification; walkthrough B; VR-13–17; TC-01–06 | §4.1, §5.2, §6 | Verified |
| S-03 | Additional unit (disguised SR) | Classification split; VR-22; routing | §4.1 | Verified (design review only) |
| S-04 | Status check | E-1; VR-09; TC-06/09 | §4.1, §6 | Verified |
| S-05 | Account-level concern | Classification; routing; X4; fields 41–43 | §4.1 | Verified (design review only) |
| T1-01…06 | Intake, triage, routing, resolution, closure, SLAs | `end_to_end_flow.md` v1.1; `sla_matrix.md` | §4 | Verified |
| T1-D1 | Flow diagram | `complaint_lifecycle.mmd/.png` (simplified version for the doc in P9) | §4 | Verified (simplified diagram Pending P9) |
| T1-D2 | Narrative (classification, routing, SLAs) | `task1_reasoning.md` §A | §4 | Verified |
| T1-D3 | Reasoning: challenges addressed | `task1_reasoning.md` §C | §4 | **Candidate** |
| T2-01 | Two complaints incl. #2 or #5 | S-01 + S-02 | §5 | Verified |
| T2-02…07 | Entry, classification, owners, actions, closure, duration | `task2_walkthroughs.md` | §5 | Verified |
| T2-D1 | ~1 page each, referencing stages | Same | §5 | Verified (condense in P9) |
| T2-D2 | Reasoning: what to change | `task2_walkthroughs.md` end; `design_review.md` | §5 | **Candidate** |
| T3-01 | Fields: name, type, source, mandatory, validation | `intake_form_spec.md` §2 | §6.1 | Verified (condense to ~25 rows in P9) |
| T3-02 | Conditions and dependencies | `intake_form_spec.md` §3 | §6.2 | Verified |
| T3-03 | Exception: status check | E-1, spec §4 | §6.3 | Verified |
| T3-04 | Exception: repeat complaint | E-2 | §6.3 | Verified |
| T3-05 | Exception: wrong site/customer | E-3 | §6.3 | Verified |
| T3-06 | 5–6 test cases for one Task 2 complaint | `test_cases.md` TC-01–06 | §6.5 | Verified |
| T3-D1/D2 | Fields table + conditions; test table | Same | §6 | Verified |
| T3-D3 | Reasoning: hardest field/validation | `intake_form_spec.md` §5 | §6.6 | **Candidate** |

**Summary:**
- **Verified:** 8/8 challenges, 5/5 complaints, and all task content requirements.
- **Pending Phase 9:** document assembly (G-01, G-02, G-06, simplified diagram).
- **Candidate:** the three reasoning notes. Drafts exist, but they should be in your own words before submission.
