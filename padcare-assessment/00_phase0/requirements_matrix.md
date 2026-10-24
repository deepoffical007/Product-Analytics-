# Requirements Matrix — PadCare Complaint Management Assessment

Source of truth: *PadCare – Product Analyst (Process & Systems) Take-Home Assessment* (PDF, not committed to this repo).
Status values: `Not started` · `In progress` · `Done` · `Verified` (passed Phase 8 audit).

## G. Submission-level requirements

| Req ID | Assessment requirement | Required output | Planned implementation | Validation method | Status |
|---|---|---|---|---|---|
| G-01 | "One Word/PDF document covering all three tasks, with embedded or linked diagrams" | Single .docx + .pdf | Phase 9 assembles all phase outputs; diagram embedded as image | Open PDF; check all 3 tasks + diagram present | Not started |
| G-02 | "At the top… an Assumptions section listing every meaningful assumption" | Assumptions section, first pages | Curated from `assumptions_register.md` (only *meaningful* ones, grouped) | Every assumption referenced in Tasks 1–3 appears in the section | Not started |
| G-03 | "At the top… a Challenges Map… mapping each of the 8 Current Challenges to the part of your design that addresses it" | Table, 8 rows, near top | `challenges_map.md` (Phase 3), condensed for doc | 8/8 rows; each cites a specific stage/field, not a generic phrase | Done |
| G-04 | "What we expect at the end of every task: a short 'Reasoning' note (3–6 lines)" | 3 reasoning notes | One per task, written last, explaining *why* + trade-off | Line count 3–6; contains a trade-off or limitation | Not started |
| G-05 | Design anchored in the 8 challenges and 5 complaints; "Generic answers will read as generic" | Whole document | Every major decision cites a challenge (C-x) or scenario (S-x) | Phase 8 audit: no decision without a C/S anchor | Not started |
| G-06 | "Quality over volume… Diagrams beat paragraphs. Reasoning beats output." | Concise doc | Tables and diagram over prose; working files stay out of final doc | Page count target 8–12 (working target, not a brief requirement) | Not started |
| G-07 | "State your assumptions. Whenever the brief is silent… write it down and proceed." | Labelled assumptions inline + register | Tag `[A-xx]` inline wherever an assumption is used | Every `[A-xx]` tag resolves in register | In progress |
| G-08 | Avoid "ITSM frameworks, P1/P2/P3 tiers, standard CRM screens" | Design vocabulary | PadCare-specific severity names and rules (see D-04) | Search final doc for P1/P2/P3 / ITIL jargon | Not started |
| G-09 | Avoid "Designing only the happy path" | Exception paths | Exception states in lifecycle; exceptions section in Task 3 | Each lifecycle state has ≥1 exit for failure; Task 3 covers 3 named exceptions | In progress |
| G-10 | Internal consistency: "Task 2's walk-throughs and Task 3's spec actually work inside the design from Task 1. Nothing dangles." | Consistent doc | Phase 8 cross-phase audit | `consistency_audit.md` with zero open issues | Not started |
| G-11 | If incomplete: "What I finished and what I didn't" note at top | Conditional note | Add only if any task is incomplete at submission | Check before export | Not started |
| G-12 | Candidate must defend choices in a 30–45 min walkthrough | Interview prep | Phase 10 prep pack; candidate makes the judgement calls | Candidate can explain each decision in `decision_log.md` unaided | Not started |

## C. The eight current challenges (each must be explicitly addressed)

| Req ID | Assessment requirement | Required output | Planned implementation | Validation method | Status |
|---|---|---|---|---|---|
| C-01 | Complaints lost between channels (WhatsApp to one CS person invisible to team; lost on leave) | Mechanism for central capture and shared visibility | Single register; mandatory logging by whoever receives it; team queue, not personal inbox | S1–S5 each enter via a named channel and land in the register | In progress |
| C-02 | Repeat vs new unknown (3rd "bad odour" from same site in two months) | Repeat detection | Related-record search at intake (customer + site + category + window); repeat count shown | Test case: repeat suggestion fires | In progress |
| C-03 | Service requests, status checks, account concerns all called "complaints" | Classification model | Separate record types with separate flows/closure rules | S1–S5 map to distinct types without ambiguity | In progress |
| C-04 | No clear handoff (billing: CS → Finance → CS; sits in nobody's inbox) | Ownership and handoff rules | One accountable owner; tracked handoff with acknowledgement + escalation | S2 walkthrough shows every handoff with owner and timer | In progress |
| C-05 | "Resolved" ≠ resolved; no customer-confirmed closure | Closure model | Resolution evidence + Awaiting Customer Confirmation state; reopen path | Test case: cannot close without evidence/confirmation | In progress |
| C-06 | Can't see patterns (e.g., 40% missed services in one city) | Structured data | Structured category/sub-category, city, site, timestamps; metric definitions | The "40% in one city" question is answerable from fields | Not started |
| C-07 | Customer has no visibility; "any update?" follow-ups | Customer update mechanism | Proactive updates at defined status changes, by CS (v1); portal deferred | S4 is handled by linking, and the design reduces S4-type volume | In progress |
| C-08 | Severity by who shouts loudest, not impact | Severity model | Impact-based rules; reporter seniority not an input | Same issue from CXO vs facility manager → same severity | In progress |

## S. The five sample complaints (all must be handled)

| Req ID | Complaint (verbatim) | Assessment's own label | Planned implementation | Validation method | Status |
|---|---|---|---|---|---|
| S-01 | "Collection was not collected this month. Please plan the visit ASAP, as it's a hygiene issue." | Operational | Operational complaint; hygiene-impact severity rule | Classification table + optional Task 2 walkthrough | In progress |
| S-02 | "Your invoice for September shows charges for the Hyderabad site, but we shifted to a new location in July. Please correct the address." | Billing | Billing complaint; CS → Finance → CS handoff; possibly also site master data correction | **Mandatory** Task 2 candidate; test cases | In progress |
| S-03 | "We need an additional disposal unit installed on our 4th floor — the existing one is overflowing daily." | "A service request in disguise" | Split: service request (new unit) + linked operational complaint (overflow) — to be stress-tested in Phase 1 | Classification table shows split rule | In progress |
| S-04 | "Just checking — has my complaint from last week about the missed service been resolved? No one has updated me." | Status check | Status enquiry linked to existing record; does not create new complaint; flags missed-update failure | Exception case in Task 3 | In progress |
| S-05 | "Service quality has dropped across multiple sites in our portfolio. We need a meeting to discuss." | Account-level concern | Account-level record owned by KAM; multi-site; closure = agreed action plan | Classification table + optional Task 2 walkthrough | In progress |

## T1. Task 1 — End-to-end complaint flow

| Req ID | Assessment requirement | Required output | Planned implementation | Validation method | Status |
|---|---|---|---|---|---|
| T1-01 | Intake: how it enters across channels; who logs it; what's captured | Intake stage in flow + narrative | Channel → logger table (6 channels); minimum capture set | All 6 channels have a named logger | Done |
| T1-02 | Classification & triage: what types exist; how severity is decided, and by whom | Classification + severity rules | Type decision table; impact-based severity matrix; named decider | S1–S5 classified; decider named | Done |
| T1-03 | Routing & assignment: owner at each stage; when it moves CS → SE → Ops Manager → KAM → Finance | Routing rules | Routing table by type; escalation triggers | Every state has exactly one owner role | Done |
| T1-04 | Resolution: what "resolved" looks like per type (call, site visit, credit note) | Resolution evidence by type | Evidence table per record type | Each type has verifiable evidence | Done |
| T1-05 | Closure & verification: how to confirm customer is actually satisfied (Challenge #5) | Closure rules | Customer confirmation step; non-response rule; reopen rule | Lifecycle has confirm/reject/no-response exits | Done |
| T1-06 | SLAs: reasonable timelines per stage, with explanation | SLA table + rationale | `sla_matrix.md`; response vs resolution separated; all labelled proposals | Every stage has a target + reason | Done |
| T1-D1 | Deliverable: flow diagram (clarity over aesthetics) | Diagram | Mermaid → rendered PNG embedded in doc | Readable at A4 width; decision points visible | Done |
| T1-D2 | Deliverable: short narrative of key decisions, esp. classification, routing, SLAs | Narrative | ~1 page, decision-led | Covers the three named topics | Done |
| T1-D3 | Deliverable: Reasoning note — which of the 8 challenges the flow addresses, and how | 3–6 line note | Written after Challenges Map | Mentions all 8 or explains any gap | Done |

## T2. Task 2 — Walk two complaints through the design

| Req ID | Assessment requirement | Required output | Planned implementation | Validation method | Status |
|---|---|---|---|---|---|
| T2-01 | Pick two of five; at least one must be #2 (billing) or #5 (account-level) | Two walkthroughs | S-01 + S-02 (confirmed, D-07) | Selection includes S-02 or S-05 | Not started |
| T2-02 | Narrate: how/where it enters; info captured at intake, and by whom | Section per walkthrough | Stage-referenced timeline | Uses Task 1 stage names verbatim | Not started |
| T2-03 | Narrate: classification — category, severity, priority — and why | Section | Applies Task 1 rules explicitly | Same result as classification table | Not started |
| T2-04 | Narrate: owner at each stage; handoffs | Section | Owner column in timeline | No ownerless gap | Not started |
| T2-05 | Narrate: what gets done to resolve (calls, visits, credit notes) | Section | Action log | Matches resolution evidence rule | Not started |
| T2-06 | Narrate: how closure happens — who confirms, on what basis | Section | Closure step | Matches closure rule | Not started |
| T2-07 | Narrate: how long the whole thing takes (per SLAs) | Elapsed-time view | Illustrative timeline consistent with SLA matrix | Sums agree with SLA matrix | Not started |
| T2-D1 | Deliverable: ~1 page per complaint, referencing stages explicitly | 2 × ~1 page | Table-led walkthrough | Page length check | Not started |
| T2-D2 | Deliverable: Reasoning note — did the walkthroughs surface anything you'd change? | 3–6 line note | Cite ≥1 real inconsistency found + v1/v2 fix (assessment calls self-critique "gold") | Names a concrete flaw | Not started |

## T3. Task 3 — Intake form functional specification

| Req ID | Assessment requirement | Required output | Planned implementation | Validation method | Status |
|---|---|---|---|---|---|
| T3-01 | Key fields: name, type, source (user / auto-filled / system-derived), mandatory or conditional, validation | Fields table | Format: Field / Type · Source / Notes & validation | Every field has all 5 attributes | Not started |
| T3-02 | Conditions and dependencies: fields appearing / becoming mandatory by type or channel | Short points | Conditional rules by record type and by channel | Each type has its own required set | Not started |
| T3-03 | Exception: status check | Short points | Link-to-existing flow; no new complaint | Matches S-04 | Not started |
| T3-04 | Exception: repeat complaint | Short points | Suggest related; user decides link/recurrence/duplicate | Matches C-02 | Not started |
| T3-05 | Exception: request raised for wrong site or customer | Short points | Customer–site validation; hard error vs warning | Matches S-02 (site moved) | Not started |
| T3-06 | Test cases: 5–6 for one Task 2 complaint, with steps and expected result | Table | Use S-02 (billing) | 5–6 rows; positive + negative | Not started |
| T3-D1 | Deliverable: fields table then conditions + exceptions in short points | Spec section | As above | Format check | Not started |
| T3-D2 | Deliverable: test cases as a table | Table | As above | Format check | Not started |
| T3-D3 | Deliverable: Reasoning note — which field or validation was hardest to decide, and why | 3–6 line note | Candidate's genuine answer (see Q-05) | Names one specific field/validation | Not started |

## E. Evaluation criteria (used as audit lenses in Phase 8)

| Req ID | Criterion | What they look for | How we'll check |
|---|---|---|---|
| E-01 | Engagement with the actual problem | Responds to 8 challenges + 5 complaints | C-01…C-08 and S-01…S-05 all `Verified` |
| E-02 | Reasoning quality | Explains why; trade-offs; limitations | Each reasoning note has a "because" and a trade-off |
| E-03 | Process clarity | Logical stages, decision points; followable by outsider | Cold read of diagram by someone unfamiliar |
| E-04 | Requirement completeness | Fields, validations, conditions, exceptions; developer needs no basic follow-ups | Developer-question checklist in Phase 8 |
| E-05 | Internal consistency | Task 2/3 work inside Task 1 | `consistency_audit.md` |
| E-06 | Communication | Organised, skimmable, no fluff, assumptions upfront | Page count; table density; no paragraph > 5 lines |

### Positive signals called out explicitly in the brief
- Variety in the 5 complaints treated as the **central** design problem (→ record-type model, Phase 1).
- Challenges Map at the top that connects each problem to a **specific** design choice (→ G-03).
- Task 2 walkthrough that **catches and flags** an inconsistency in our own design (→ T2-D2, `design_review.md`).
- Task 3 validations that clearly **come from the complaint examples**, not a template (→ trace each validation to S-x).
- Explicit trade-offs: "I could do X or Y; here's why X" (→ decision log format).

### Negative signals called out explicitly
- Generic ITSM / P1-P2-P3 / standard CRM screens (→ G-08).
- Long padded prose (→ G-06).
- Happy path only (→ G-09).
- Reasoning that describes instead of explains (→ G-04).

## X. Master-prompt deliverables that go beyond the brief

These are useful working files, but the brief does not ask for them. They feed the final document; they are not reproduced in full.

| Item | Phase | Use in final doc |
|---|---|---|
| Data model | 7 | Short entity list supporting Task 3 (≤ ½ page) or omitted |
| Analytics spec | 7 | Supports C-06 row of Challenges Map; ≤ ½ page |
| Full SLA matrix (7 stages) | 2 | Condensed into Task 1 SLA table |
| Requirements traceability | 6, 8 | Not in final doc (internal QA) |
| Interview prep | 10 | Not in final doc |
