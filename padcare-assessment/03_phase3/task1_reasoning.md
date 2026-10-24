# Phase 3 — Task 1 Narrative and Reasoning

> The narrative below is the Task 1 "short narrative explaining key decisions — especially around classification, routing and SLAs". Each card is ≤ 6 lines.
> **Candidate action:** rewrite the final Reasoning note (§C) in your own words before submission. It is the part most likely to be quoted back to you in the walkthrough.

## A. Key decisions (narrative)

### Classification

**1. Four case types; a status check is attached to an existing case, not created as a new one.** (C-3, S-04)
Each type needs a different owner, path and definition of "done". A missed collection ends with a visit, a billing issue with an invoice, a request with fulfilment, and an account concern with a plan.
A status check has no work of its own. Making it a case would inflate complaint counts and create something that could be "closed" while the real issue stays open.
*Rejected:* one "complaint" record with a free-text type, which is today's problem with a dropdown added. *Trade-off:* "Case" is a new word for teams.

**2. Classification is five ordered questions, not a flat dropdown.** (S-02, S-03, S-04, S-05)
The samples are traps if read by keyword: S-04 mentions a missed service, S-05 mentions service quality, S-02 mentions a site move, and S-03 mentions overflow. Asking "already raised?" → "account-level?" → "billing?" → "failure?" → "new request?" in that order puts each one in the right type.
*Trade-off:* a few seconds slower than picking from a list.

**3. Split independent needs into linked cases; keep dependent needs inside one case.** (S-03)
The overflow needs relief this week; the extra unit may take weeks and approval. As one case, either the overflow waits for the installation, or the case closes before the unit arrives.
*Trade-off:* judging "independent" needs training examples.

### Severity and priority

**4. Severity comes from impact rules, with three named levels and three escalators. The reporter's identity is never an input.** (C-8)
The levels test what is happening at the site (hygiene exposure now? service or billing commitment broken?), not who is asking. Recurrence, multi-site scope and overdue days raise the level automatically, so a polite report of the third odour complaint at a large account outranks a loud cosmetic one.
*Rejected:* P1–P4 tiers set by judgement, which is how "loudest wins" happens today. *Validate:* the thresholds.

**5. Priority is a computed queue order, not a second label.** (C-8)
Severity → time left before the deadline → flags (rejected, chased, recurrence) → age. An "Expedite" flag exists because influence is real, but it needs a reason and its use is reported. That makes escalation by influence visible instead of invisible.

### Routing and ownership

**6. Two owner fields: a resolution owner that moves, and a communication owner (CS) that stays.** (C-4, C-7)
Finance should investigate a billing complaint without becoming the customer's contact. The customer should hear from one person throughout.
*Trade-off:* each side may assume the other updated the customer, so the rule is explicit: CS always sends updates.

**7. Ownership moves on acceptance, not assignment.** (C-4)
Today a forwarded email counts as a handoff, and the issue sits in nobody's inbox. Here the sender stays accountable until the receiver accepts, or returns it saying what is missing. No answer escalates.
*Alternative:* auto-reassign on breach. Rejected, because it moves the problem rather than forcing a decision.

**8. The receiver logs it, and the case is owned from the moment it is created.** (C-1)
The account's CS owner owns every new case, or the city CS queue covers when that person is on leave. Logging takes about 2 minutes (D-15), because a form slower than a WhatsApp reply would not get used.
*Limitation:* v1 still depends on people logging. Lost issues surface, and are counted, when customers chase.

### Resolution, closure, SLAs

**9. "Resolved" requires evidence per type; "Closed" requires the customer.** (C-5)
The system will not move a case to Awaiting Confirmation without the type's evidence (visit proof, credit note number, install record, action plan). CS then asks the customer.
No reply after two reminders closes it as "No Response", which is reported separately from confirmed closures. A return within 14 days reopens it.
*Trade-off:* some unresolved issues close silently, which is why the two closure types are reported separately.

**10. SLAs separate response from resolution, start when the customer told us, and pause only for the customer.** (C-1, C-4, C-7)
- *Response targets* (acknowledge, ETA, maximum silence) are the same for every type. They solve visibility without a portal.
- *Resolution targets* vary by type and severity. A Hygiene-Critical visit must happen within 24 calendar hours, because waste builds up at weekends too; billing gets 5 business days, so the correction lands before the next invoice.
- Starting from "received" makes late logging visible. Allowing only customer pauses means internal waits can't be hidden.

All targets are proposals to calibrate with real data. The 24 h visit depends on SE capacity per city (A-20).

## B. Decision rationale table (for interview preparation)

| Decision | Problem solved | Why preferred | Alternative considered | Trade-off | Validate with PadCare |
|---|---|---|---|---|---|
| 4 case types + status attached to parent | C-3, C-5 | Different owners and evidence per type | Single complaint record; 5 types incl. status | New vocabulary | Do CS teams recognise the 4 types? |
| Ordered classification questions | C-3 | Resolves keyword traps in S-02/03/04/05 | Flat dropdown | Slightly slower | Reclassification rate after launch |
| Split independent needs | C-3, C-5 | Separate closure conditions | Single case | Admin + judgement | Training examples |
| Impact severity + escalators | C-8, C-2 | Rules, not voices | Judgement-based tiers | Coarse; thresholds unproven | 3-day / 3-site / 3rd-in-90-days thresholds |
| Computed priority + reported Expedite | C-8 | Transparent queue | Manual priority | Less manual control | Who may expedite |
| Resolution owner + communication owner | C-4, C-7 | One voice to the customer | Single owner | Coordination rule needed | CS capacity |
| Ownership on acceptance | C-4 | No ownerless gap | Transfer on assignment; auto-reassign | Sender burden | Field acceptance practicality (SEs) |
| Receiver logs; owner from creation | C-1 | Removes single-person dependency | Central intake team | Logging discipline | CS rota for the shared inbox |
| Evidence + customer-confirmed closure | C-5 | "Done" is verifiable | Close on reply | Silent no-response closures | Customer willingness to confirm |
| Response/resolution split; received-at clocks | C-1, C-4, C-7 | Shows which team is the bottleneck | Single "resolution time" | More targets to manage | 24 h visit feasibility; Finance cycle |

## C. Task 1 Reasoning note (draft — about 6 lines on A4; rewrite in your own words)

> The flow answers what PadCare can't today: did we get it, who owns it, is it fixed, has it happened before. The receiver logs it, and a CS owner holds it from creation (C1). Ordered classification keeps status checks, requests and account concerns out of the complaint queue (C3). A history panel and a recurrence rule surface repeats (C2, C6). Ownership moves only on acceptance (C4), closure needs evidence plus the customer's confirmation (C5), and severity follows hygiene impact and recurrence, not the reporter's seniority (C8). The weakest areas are C1 and C7: v1 still depends on people logging and updating.

Word count: ~95 (≈ 6 lines at A4 width, 11 pt).
