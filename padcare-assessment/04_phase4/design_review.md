# Phase 4 — Design Review (findings from the walkthroughs)

Each finding states: what broke, why it matters, the fix, and whether it is applied now (**v1** — the Task 1 design is updated) or deferred (**v2**).

| ID | Found in | Type | What broke | Why it matters | Fix | Version |
|---|---|---|---|---|---|---|
| **F-1** | S-02, step 2.5 | **Inconsistency** | Phase 1 rated S-02 *Service-Impacting*; Phase 2 defines *Low-Impact* as "a document error with no effect on the amount", which describes S-02 exactly. Two defined rules give two answers | Severity must be the same whoever triages (C-8); a rule that depends on interpretation brings back judgement calls | Billing severity is redefined by **whether the customer can act on the invoice**: *Service-Impacting* = amount wrong **or** the invoice cannot be processed by the customer (wrong entity, site or address). *Low-Impact* = a cosmetic error that does not stop processing. The "unusable invoice" test is asked as an impact question | **v1** |
| **F-2** | S-02, step 3.3 | **State-machine gap** | A returned handoff left the case in `Assigned` with the sender, but `On Hold – Customer` is only reachable from `In Progress`. CS needed a workaround | A spec a developer builds literally would block a real path; workarounds corrupt timestamps | Return → **`In Progress` with the sender** (the sender was already the accountable owner). Transition updated | **v1** |
| **F-3** | S-02, step 4.4 | **Missing concept** | Finance needed another team (the site master-data owner) to do a piece of work. The only tool was a handoff, which would move ownership; Finance fell back to email | This recreates C-04's "forwarded emails" *inside* the new system | Add **linked tasks**: owner, due date, done/not done, inside a case. The **case owner stays accountable**; the task owner is accountable for the task; overdue tasks escalate like handoffs; **mandatory tasks block resolution**. Also used for SE visits (F-4) and S-03-style installations | **v1** |
| **F-4** | S-01, step 3.2 | **Practicality** | Hygiene-Critical cases were assigned to an SE in the field with a 1 h acceptance target. The SE was on route and did not respond; escalation worked but cost ~1.5 h | The most urgent cases depend on the person least able to respond to notifications | For **Hygiene-Critical** operational complaints, the resolution owner = **Ops City Manager** (desk-based, accepts within 1 h). The SE visit is a **linked task** (F-3). Service-Impacting / Low-Impact still go to the scheduled SE (4 business h acceptance is workable). *Trade-off:* more load on Ops City Managers; validate volume | **v1** |
| **F-5** | S-01, step 5.1 | **Duplicate effort** | The SPOC signed off on site in the SE app, then CS asked "is this resolved?" again | Asking twice irritates customers and delays closure | If the **sign-off is by the reporter or the SPOC**, it counts as confirmation → `Closed – Confirmed (on site)`; CS sends a closure note instead of a question. A sign-off by anyone else (e.g., security) still triggers the CS request | **v1** |
| **F-6** | S-01, step 4.4 | **Root cause left open** | One make-up visit resolved the case, but the regular schedule had dropped (*Rescheduled* with no date). Next month could be missed again | The case closes "resolved" while the cause continues; it returns as a recurrence (C-02, C-05) | Evidence for *Missed collection* adds: **"next scheduled visit confirmed in the schedule"** (date) | **v1** |
| **F-7** | S-02, step 3.3 | **Intake gap** | Finance returned the case for the missing new address and effective date | Each return costs about a day; the information was predictable from the sub-category | Task 3: when sub-category = *Wrong site/address*, **correct address + effective date are mandatory at triage** (hard validation before a Finance handoff) | **v1** (Phase 5) |
| **F-8** | S-02, step 4.1 | **Scope blind spot** | The customer named September; July and August were also wrong | Fixing only the reported invoice guarantees a second complaint | Finance handoff checklist adds **"identify all invoices affected since the effective date"**; the evidence lists every reissued invoice | **v1** |
| **F-9** | S-02, closure | **Verification gap** | Nothing confirms the *next* invoice is correct after the master-data fix | The fix is assumed, not verified | Automatically flag the account's next invoice for a check (needs billing data in PadCareOne `[A-03]`) | **v2** |
| **F-10** | S-01, R3 | **Measurement risk** | If CS replies informally on WhatsApp ("checking") before logging, R3 is measured only from the logged acknowledgement | Fair performance data; avoids gaming | At Log, allow "**customer already acknowledged at** [time]" to be recorded as a customer update. Only acknowledgements that include a case reference count towards R3 | **v1** (minor) |
| **F-11** | Both | **Assumption exposed** | The site master-data owner is unknown `[A-18]`; F-3 tasks need a named owner | A task with no owner is the C-04 problem again | Name the owner during PadCare validation. Default until then: the Ops City Manager of the site's city | Open question |

## What I would change but deliberately did not

| Idea | Why not in v1 |
|---|---|
| Auto-confirm closure when the SE app sign-off exists for every case | The sign-off can come from someone who did not report the issue; the confirmation must come from the person who complained or the SPOC |
| Merge Finance and CS into one "billing desk" owner | Changes PadCare's organisation, which is beyond a product design |
| Severity escalator for "3+ invoices affected" | Known only after investigation; severity is set at triage. Use the recurrence rule instead if it repeats |

## Changes applied to the Task 1 design (v1)

Changes applied in `02_phase2/end_to_end_flow.md`, marked † in the final document:
1. Billing severity definitions (F-1).
2. Return → `In Progress` with the sender (F-2), in the state diagram and status table.
3. Linked tasks concept (F-3) in ST3/ST4.
4. Hygiene-Critical operational routing to the Ops City Manager plus an SE task (F-4).
5. On-site sign-off as confirmation (F-5).
6. Missed-collection evidence includes the next scheduled visit (F-6).
7. Finance checklist: all affected invoices (F-8).
8. Prior-acknowledgement capture (F-10).

F-7 goes into the Task 3 spec (Phase 5). F-9 is listed as v2.
