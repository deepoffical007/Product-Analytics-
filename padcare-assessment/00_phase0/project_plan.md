# Project Plan

## Phases and gates

Each phase ends with a review gate: the candidate reads the output, confirms or changes decisions in `decision_log.md`, then the next phase starts.

| Phase | Objective | Deliverables | Depends on | Covers Req IDs | Status |
|---|---|---|---|---|---|
| 0 | Extract requirements, set up logs | requirements_matrix, assumptions_register, decision_log, project_plan | — | all (mapping) | Done |
| 1 | Problem framing, scope, record types | problem_definition, classification_matrix | 0 | C-03, S-01…S-05, T1-02 | Done |
| 2 | End-to-end process, diagram, SLAs | end_to_end_flow, complaint_lifecycle.mmd, sla_matrix | 1 | T1-01…T1-06, T1-D1, C-01, C-04, C-05, C-08 | Done |
| 3 | Task 1 reasoning + Challenges Map | task1_reasoning, challenges_map | 2 | T1-D2, T1-D3, G-03, C-01…C-08 | **Done — awaiting review** |
| 4 | Task 2 walkthroughs + self-critique | task2_walkthroughs, design_review | 2, 3 | T2-01…T2-D2 | Not started |
| 5 | Task 3 intake spec | intake_form_spec, validation_rules, exception_handling | 1, 2, 4 | T3-01…T3-05, T3-D1 | Not started |
| 6 | Functional test cases (billing) | test_cases, requirements_traceability | 5 | T3-06, T3-D2 | Not started |
| 7 | Data model + analytics | data_model, analytics_spec | 5 | C-06 | Not started |
| 8 | Consistency audit | consistency_audit, final_requirements_traceability | 1–7 | G-10, E-01…E-06 | Not started |
| 9 | Final document | .docx + .pdf | 8 | G-01…G-11 | Not started |
| 10 | Interview prep | overview, walkthrough script, Q&A | 9 | G-12 | Not started |

## Notes carried forward
- Phase 9: the detailed flow diagram is too dense for an A4 page. Draw a **simplified top-level diagram** for the document (ST1–ST5 with the main decisions), and link or append the detailed one.

## Key risks to the submission

| Risk | Mitigation |
|---|---|
| Looks AI-generated / generic | Every decision anchored to a challenge or sample complaint; candidate rewrites the reasoning notes in their own words |
| Over-length | Working files ≠ final doc (D-05); 8–12 page working target |
| Inconsistency across tasks | Single lifecycle and type list defined once (Phases 1–2), reused everywhere; Phase 8 audit |
| Invented PadCare facts | Assumptions register; `[A-xx]` tags inline |

## Questions for you (candidate)

Only questions that would materially change the design. Defaults apply if unanswered.

| ID | Question | Default if no answer |
|---|---|---|
| Q-01 | Which two complaints for Task 2? | **Answered:** defaults (S-01 + S-02) |
| Q-02 | Do you know anything real about PadCareOne (customer/site master, service schedules, SE mobile app, invoices)? | Treat as assumptions A-01, A-02, A-03, A-05 |
| Q-03 | Deadline / hours available? | Full plan, phase by phase |
| Q-04 | Use "Case" as the umbrella term? | **Recommended in Phase 1:** yes (D-06/D-10) — confirm |
| Q-06 | Rewrite the Task 1 Reasoning note (03_phase3/task1_reasoning.md §C) in your own words | Draft stays, flagged |
| Q-05 | Task 3 reasoning asks what was *hardest for you* — please note your honest reaction as we go | Draft one, flag for your rewrite |
