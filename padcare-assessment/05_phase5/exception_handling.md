# Phase 5 — Exception Handling

The first three are the exceptions the brief names explicitly for Task 3. The rest are those the master prompt and walkthroughs require. Each is written as short points, as the brief asks.

## E-1. Status check (S-04)
- Logger selects **Status enquiry** (Q1 = Yes) → the form collapses; **Parent case** is required (VR-09).
- **Parent open** → follow-up added; "customer chased" flag raises priority. The communication owner gets an "update customer" task due within R3. **No new case.**
- **Parent `Awaiting Confirmation`** → CS asks whether it is resolved; the answer is recorded as the confirmation outcome.
- **Parent closed ≤ 14 days ago and the customer says it is not fixed** → reopen the parent (reason required).
- **Parent closed > 14 days ago** → a new case linked *Recurrence of*.
- **No parent found** → convert to the full form: *Not logged at receipt* = Yes; Received at = the customer-stated original date (VR-06 reason). Counted as a lost complaint (C-1).
- **Parent belongs to another customer** → blocked (VR-10).
- An answered status enquiry **never** changes the parent's status (C-5).

## E-2. Repeat complaint (C-2)
- **Same incident, still open** (VR-11 → "Same — add as follow-up"): becomes a follow-up, as in E-1.
- **Same incident, second reporter** (e.g., End User emails while the SPOC WhatsApps): "Same — duplicate report" → saved as `Closed – Cancelled – Duplicate`, linked to the parent; the second reporter is added as a parent contact. One case, two people informed.
- **New incident of the same kind after an earlier one was resolved:** a new case. The system suggests *Recurrence of* when the earlier case is within 90 days.
  - At the 3rd case → Recurrence flag, severity +1 level, Ops City Manager root-cause review, KAM informed (VR-12).
- **Same site, different sub-category:** shown in the panel as context only; no forced link.
- **The system never merges automatically.** Every link records who decided and when `[D-14]`.

## E-3. Request raised for the wrong site or customer
- **Site belongs to a different customer** → hard error at Log (VR-02); pick the correct pair.
- **Site not in master / customer says it moved** (S-02) → Log continues with the "Unverified site" flag and *Site as stated*. Triage must:
  - choose the correct existing site, **or**
  - create a **site-record correction task** for the master-data owner `[A-18]`, which blocks resolution if mandatory (F-3).
- **Customer not in master** → logged against "Unmatched customer" with the stated name; Triage cannot complete until matched (VR-01). Unmatched cases appear on the city CS queue.
- **Wrong customer or site discovered after Triage:**
  - CS changes it with a reason (event logged);
  - SLA clocks are unchanged (same issue, same received time);
  - related-record checks re-run;
  - existing links to the old customer's cases are flagged for review.
- **Reporter not from the customer on record** (e.g., a building management company): logged against the actual customer, with reporter role "Other".

## E-4. Multiple issues in one message (S-03, check-in calls)
- **Split check** (field 21) after classification: *independent* needs → "Create linked case" with shared fields pre-filled, link type *Split from*.
- **Dependent needs** stay as actions in one case (e.g., "missed and charged" → operational complaint + credit-note task if the miss is confirmed).
- A service request reporting a current problem → soft block VR-22 (create the linked complaint or give a reason).
- Check-in calls: "Add another issue from this call" keeps the reporter, channel and received time.

## E-5. Missing mandatory information
- **At Log:** only the identity, customer, reporter and words fields block saving. Everything else can wait for Triage.
- **At Triage:** type-specific requirements (§3.1 of the spec) block *completion*. The case stays `New`, and Triage SLA R2 keeps running, so a stalled triage is visible.
- **At handoff:** checklist VR-31 blocks the handoff. Finance can also **return** a case with a reason, which goes back to `In Progress` with the sender (F-2).
- **Information only the customer has:** `On Hold – Customer` (clock paused; reminders at day 2 and 4; closes at day 7 with a final message).

## E-6. Invalid attachments
- Wrong type, oversize, more than 5 files, or an unreadable file → that file is rejected with the reason (VR-25). **The rest of the form still saves**; the user is not forced to re-enter anything.
- A WhatsApp screenshot that is too large → prompt to compress, or attach a PDF.

## E-7. Unauthorised status changes
- Blocked by the role × transition matrix (VR-27), with the message naming the role and transition.
- Attempts are logged (an audit event), not just refused.
- Closure without evidence is impossible for every role (VR-33); a closed case is corrected only by reopening it.

## E-8. Customer non-response
- **At `Awaiting Confirmation`:** reminders at business days 2 and 4 → `Closed – No Response` at day 5 (V2).
  - Excluded from the confirmed-closure rate.
  - If the reporter or SPOC signed off on site, the case is already confirmed (F-5).
- **At `On Hold – Customer`:** reminders at days 2 and 4 → closed at day 7, closure reason **No Response** (sub-reason: information request) (V4).
- **Hygiene-Critical** cases closing as No Response trigger an SE check on the next scheduled visit (record a task).

## E-9. Reopening after closure
- **Within 14 days**, same issue → reopen (CS/KAM/Ops City Manager, with a reason):
  - goes to `In Progress` with the last resolution owner;
  - reopen count +1;
  - the resolution clock restarts from the reopen time.
- **After 14 days** → a new case linked *Recurrence of*; feeds VR-12.
- **Duplicate or invalid found to be valid** → reopen with a reason (any CS).

## E-10. Cancelled or invalid records
- **Closure reasons:** *Cancelled – Duplicate* (link required), or *Cancelled – Invalid* with a sub-reason:
  - not a PadCare issue (e.g., the customer's own cleaning staff);
  - logged in error;
  - test record.
- **Who can cancel:** CS, KAM, or the Ops City Manager. Cancelled records **stay in the register** and in the volume-by-channel counts, but are excluded from the complaint metrics.
