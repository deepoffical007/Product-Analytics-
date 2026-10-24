# Phase 1 — Problem Definition and System Boundary

Tags: `[A-xx]` = assumption (see `00_phase0/assumptions_register.md`), `[D-xx]` = decision (see `decision_log.md`), `C-x` = brief challenge, `S-x` = sample complaint.

## 1. The business problem (one paragraph)

PadCare delivers ~40,000 services a month to 2,000+ sites in 24+ cities. Customer issues arrive through six informal channels and live in individual people's WhatsApp chats, inboxes and memories. As a result, PadCare cannot reliably answer four basic questions about any issue: **Did we receive it? Who owns it right now? Is it actually fixed? Has this happened before?** Across all issues, it cannot answer a fifth: **Where are we failing most?** The module must make every customer issue a **record with one owner, a type-appropriate path to a verified outcome, and structured data**. It must do this without slowing down the people who receive the issues.

## 2. Root causes behind the 8 challenges

The 8 challenges collapse into four root causes. The design targets the causes, not the symptoms.

| Root cause | Challenges | Design response (detailed in later phases) |
|---|---|---|
| **R1. The issue lives with a person, not in a system** | C-01, C-04, C-07 | Central register; the receiver must log it; a team-visible queue; tracked handoffs |
| **R2. Every interaction is called a "complaint"** | C-03, C-05, C-06 | Record types with their own owner, workflow and closure evidence (this phase) |
| **R3. No memory of history** | C-02, C-06 | Related-record search at intake; customer/site/category on every record |
| **R4. No shared definition of "serious" or "done"** | C-05, C-08 | Severity based on impact rules; closure confirmed by the customer |

## 3. Users

| User | Interaction with the module | What they need from it |
|---|---|---|
| **CS** (primary) | Logs most issues, triages, owns customer communication | Fast logging; one queue; full history of the customer/site; prompts for when to update the customer |
| **SE** | Logs on-site verbal complaints `[A-05]`; executes visits and corrective actions | Quick log from the field; clear task with due date; way to attach proof |
| **Ops City Manager** | Receives operational escalations; owns city-level performance | View of escalated and overdue items in their city; repeat hotspots |
| **KAM** | Logs escalations they receive; owns account-level concerns | Account-wide view across sites and cities |
| **Finance** | Investigates billing complaints; issues corrections/credit notes `[A-11]` | Clear handoff with invoice details attached; due date |
| **Client SPOC / End User** (indirect) | Raise issues; confirm resolution | Acknowledgement, proactive updates, a reference number; asked "is it fixed?" before closure. **No direct system access in v1** `[A-06]` |
| **Leadership / Product** (indirect) | Consume reports | Trustworthy, structured data |

## 4. Module objectives (proposed, measurable)

Targets are proposals for validation, not PadCare commitments `[A-07]`.

| # | Objective | Indicator (defined fully in Phase 7) | Challenge |
|---|---|---|---|
| O1 | Every customer issue is in the register, regardless of channel | Share of records logged from each channel; "found only on a later status enquiry" count → trend to 0 | C-01 |
| O2 | Every open record has exactly one accountable owner | Records without an owner = 0 (hard rule) | C-04 |
| O3 | Repeat issues are visible at the moment of intake | Share of repeats identified at intake vs found later | C-02 |
| O4 | Interactions are separated by type | Share of records reclassified after triage (lower = clearer rules) | C-03 |
| O5 | Closure means the customer confirmed, or a defined no-response rule applied | Reopen rate; share of records closed on confirmation | C-05 |
| O6 | Issues can be analysed by city, site, customer, category and time | All of these fields are structured, not free text | C-06 |
| O7 | Customers stop having to chase | Status enquiries per open record | C-07 |
| O8 | Severity follows impact rules, not who is asking | Severity overrides logged with a reason; reporter seniority is not an input | C-08 |

## 5. System boundary

### In scope — version 1

| Area | v1 scope |
|---|---|
| Register | One central register of **Cases** in PadCareOne `[D-10]` |
| Intake | Manual logging by the PadCare employee who receives the issue, from any of the 6 channels `[D-09]`. Logging happens in two steps: a fast **Log** step, then a **Triage** step that completes the record `[D-15]` |
| Classification | 4 case types + status enquiries attached to existing cases (see `classification_matrix.md`) |
| Related records | Search for and suggest related cases (same customer/site/category/time window); links between cases. No automatic merging |
| Severity and priority | Rule-based, impact-led; defined in Phase 2 |
| Ownership | One accountable owner; tracked handoffs with acknowledgement; escalation timers |
| Lifecycle | Statuses, closure evidence by type, customer confirmation, reopening |
| Customer communication | CS sends updates through the customer's existing channel; **every update is logged on the case** |
| Reporting | Structured fields and status/owner history sufficient for core metrics; a basic list/report view |

### Out of scope — deferred or external

| Item | Why | When |
|---|---|---|
| WhatsApp / email / telephony integration | No evidence it exists `[A-04]`; v1 proves the process first | v2 — automatic capture from the support inbox first (highest volume per effort, assumed) |
| Customer self-service portal / tracking link | PadCareOne is internal `[A-06]` | v2 — read-only status link by case reference |
| Invoice generation / credit-note issuing | Finance's existing process, whatever it is `[A-03]`; the module records the outcome and reference | Integration later |
| Field scheduling / dispatch | Assumed to exist in PadCareOne `[A-02]`; the module creates or links a visit request, it does not replace scheduling | — |
| Commercial negotiation content (pricing, contract terms) | Captured as an account-level case so it is visible, but the negotiation itself happens outside | — |
| Automatic classification (NLP/AI), sentiment | Needs labelled history first, which v1 creates | v3 |
| Compliments / general feedback | Not in the brief's problem set | Later, if wanted |

## 6. Design principles carried into all phases

1. **Classify by what the customer needs PadCare to do**, not by the words used (S-03, S-04, S-05 all use "complaint" words but need different responses).
2. **One case per independent customer need**, not per message. A message can create 0 cases (a pure status enquiry), 1, or several linked cases.
3. **Logging must be faster than not logging.** Only the minimum is mandatory at Log; the rest is completed at Triage. A heavy intake form would push CS back to WhatsApp, which recreates C-01.
4. **The system suggests and a person decides** — for repeats, duplicates and severity overrides. Every override needs a reason.
5. **Two owner roles per case:** the *resolution owner* (whoever must act now; this changes on handoff) and the *communication owner* (CS for the customer; stable). This separates C-04 handoffs from C-07 customer contact.
6. **"Done" is defined per type** by evidence, not by a reply to the customer.

## 7. Known risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| CS/SE don't log issues received informally (adoption) | High | Two-step intake; KAM and SE can log; a lost issue that surfaces later via a status enquiry is flagged and counted (makes the gap visible) |
| Misclassification at Log | Medium | Type can be changed at Triage with a reason; reclassification rate tracked |
| Customers don't confirm closure | High | Defined non-response rule (Phase 2) rather than leaving cases open forever |
| Master data is wrong (e.g., S-02 relocated site) | Medium | "Site not found / site changed" exception path; corrections routed to whoever owns master data |
| Over-engineering for v1 | Medium | Out-of-scope table above; Phase 8 audit for anything nobody would use |
| Severity rules are gamed or ignored | Medium | Overrides need a reason and are reported |

## 8. Unresolved questions (for PadCare)

| # | Question | Why it matters | Current assumption |
|---|---|---|---|
| U-1 | Does PadCareOne hold customer, site and service schedule records? | Validation and visit linking | Yes `[A-01]` `[A-02]` |
| U-2 | Is every account assigned a named CS owner? Is there a CS team lead? | Auto-assignment; cover during leave | Named CS owner yes `[A-09]`; a CS Lead role is **not** in the brief, so it is not relied on `[A-15]` |
| U-3 | Who owns an account-level concern when the account has no KAM? | S-05 routing | Ops City Manager of the account's primary city `[A-10]` `[A-15]` |
| U-4 | Does an additional unit (S-03) change the customer's charges or contract? | Whether a service request needs commercial approval | Possibly; the design allows an approval step `[A-16]` |
| U-5 | What is the normal service frequency by site type? | Hygiene severity threshold for missed collections | Varies, at least monthly at some sites `[A-08]` |
| U-6 | Complaints raised before go-live — migrate or not? | S-04-type enquiries about issues that were never logged | Not migrated; created on demand when chased `[A-17]` |
