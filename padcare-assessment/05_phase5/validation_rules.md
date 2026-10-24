# Phase 5 — Validation Rules

**Severity of a rule:**
- **E = hard error** — blocks the save or the transition.
- **S = soft block** — the user must explicitly choose an option to continue.
- **W = warning** — informs; does not block.

**Checked at:** L = Log save · T = Triage completion · H = handoff · X = status transition.
**Origin:** the sample complaint, challenge or finding that motivates the rule. Rules without a specific origin are standard data integrity.

| ID | Rule | Checked at | Kind | Message shown (draft) | Origin |
|---|---|---|---|---|---|
| VR-01 | Customer selected, or "Unmatched customer" with the name as stated; Triage cannot complete while unmatched | L / T | E | "Select the customer account, or choose *Customer not in list* and type the name the customer gave." / at T: "Match this case to a customer account before completing triage." | C-1 |
| VR-02 | The selected site belongs to the selected customer | L | E | "{Site} belongs to {Other customer}. Choose a site under {Customer}, or tick *Site not in list*." | Brief: "wrong site or customer" |
| VR-03 | Site not in list / disputed → *Site as stated* required; resolved by Triage (correct site chosen, or master-data task created) | L / T | W at L, E at T | "Site marked unverified. Triage must confirm the site or raise a site-record correction." | S-02, F-11 |
| VR-04 | Site or customer marked inactive in master | L | W | "{Site} is inactive since {date}. Check whether the customer has moved." | S-02 |
| VR-05 | Received at ≤ now and ≤ Logged at | L | E | "Received time can't be in the future." | D-25 |
| VR-06 | Received at earlier than the R1 window → late notice; more than 30 days → reason required | L | W / E | "This will be recorded as late registration (target {R1})." / "Explain why this is logged more than 30 days after it was received." | C-1, S-04 |
| VR-07 | Reporter has a phone or an email, in a valid format | L | E | "Add a phone number (10 digits) or an email so we can update the reporter." | C-7 |
| VR-08 | Customer's words ≥ 10 characters | L | E | "Record what the customer said, in their words." | C-6 |
| VR-09 | Status enquiry has a parent case, or "No existing case found" | L | E | "Link the case the customer is asking about, or choose *No existing case found*." | S-04 |
| VR-10 | A linked or parent case belongs to the same customer (different site → warning) | L / T | E / W | "Case {ID} belongs to {Other customer} and can't be linked." / "Case {ID} is at a different site ({Site}). Link anyway?" | S-04, wrong customer |
| VR-11 | An **open** case exists at the same site with the same sub-category | L / T | **S** | "Open case {ID} ({sub-category}, {status}, owner {name}, logged {date}) looks similar. Is this the **same incident**? [Same — add as follow-up] [Same — duplicate report from another person] [Different incident — continue]" | C-2, S-04 |
| VR-12 | ≥ 2 previous cases at the same site + sub-category within 90 days | T | W (automatic) | "This is case #{n} for {sub-category} at {site} in 90 days. Marked **Recurrence**; severity raised one level (billing: escalated instead, F-12); root-cause note required at resolution." | C-2 |
| VR-13 | Billing: invoice number present, 4–30 characters, letters/digits/`-`/`/` | T / H | E | "Enter the invoice number from the customer's invoice. Finance cannot start without it." | S-02 |
| VR-14 | Billing: invoice month not in the future; older than 12 months → warning | T | E / W | "Invoice month can't be in the future." / "This invoice is over 12 months old. Confirm with Finance before raising." | S-02 |
| VR-15 | Billing, sub-category Wrong site/address (or site flagged "moved"): correct address + effective date present before the Finance handoff; effective date ≤ today; effective date after the invoice month → warning | H | E / W | "Add the correct address and the date the change took effect — Finance needs both to reissue." / "The move date ({date}) is after this invoice's month; the invoice may be correct." | **S-02, F-7** |
| VR-16 | Billing: disputed amount > 0 for Wrong amount / Charged for service not delivered / Duplicate | T | E | "Enter the amount the customer disputes." | S-02 |
| VR-17 | Billing: "Can the customer process this invoice?" answered | T | E | "Answer whether the customer can process the invoice — this sets severity." | F-1 |
| VR-18 | Missed collection / Late service: a scheduled visit linked, or "No scheduled visit found" (→ Ops flag). Schedule says *Completed* → data-integrity warning | T | E / W | "Link the scheduled visit that was missed." / "Our schedule shows this visit as **completed** on {date}. Flagged for Ops City Manager review." | **S-01** |
| VR-19 | Operational / service request: location on site present | T | E | "Where on site? (e.g., 4th floor, ladies' washroom)" | S-03 |
| VR-20 | Operational: hygiene exposure answered Yes/No (not Unknown) | T | E | "Confirm with the customer whether units are full, overflowing or damaged now." | **S-01, C-8** |
| VR-21 | Final severity ≠ system severity → reason required; a downgrade from Hygiene-Critical notifies the Ops City Manager | T | E / W | "Give a reason for changing severity from {system} to {final}." | C-8 |
| VR-22 | Service request with "current problem reported" = Yes → create a linked operational complaint or record why not | T | **S** | "The customer also reports a current problem. [Create linked complaint] [No complaint needed — reason]" | **S-03** |
| VR-23 | Service request: requested-by and committed dates ≥ today | T | E | "Date must be today or later." | S-03 |
| VR-24 | Account-level concern: account has no KAM → route to the primary city's Ops City Manager | T | W | "This account has no KAM. Routed to {Ops City Manager}." | S-05, A-10 |
| VR-25 | Attachments: allowed types (JPG, PNG, PDF, EML, MSG, DOCX, XLSX), ≤ 10 MB, ≤ 5 files; executable or unreadable files rejected | L / any | E | "{file} can't be attached: {reason}. Allowed: JPG, PNG, PDF, EML, MSG, DOCX, XLSX up to 10 MB." | — |
| VR-26 | Possible double submission: same reporter + site + similar words within 10 minutes | L | S | "You logged a similar case {ID} {n} minutes ago. [Open it] [This is different — save]" | C-1 |
| VR-27 | Status changes allowed only per the role matrix below | X | E | "{Role} can't move a case from {status} to {status}." | C-4, C-5 |
| VR-28 | Expedite: KAM or Ops City Manager only, with a reason | T / any | E | "Only a KAM or Ops City Manager can expedite, with a reason." | C-8 |
| VR-29 | "Customer already acknowledged at" between Received at and now | L | E | "Acknowledgement time must be between received time and now." | F-10 |
| VR-30 | Channel = SE on site → logger is an SE, or the SE's name is recorded | L | E | "Name the SE who received this on site." | C-1 |
| VR-31 | Handoff checklist complete for the target team (Finance: VR-13, 14, 15, 16, 17 + customer evidence; SE/Ops: location, access contact, severity) | H | E | "Complete before handing to {team}: {missing items}." | C-4, F-7 |
| VR-32 | Case type changed after Triage → reason required; re-runs type-specific checks | any | E | "Give a reason for reclassifying." | C-3 |
| VR-33 | Move to `Awaiting Confirmation` requires the resolution evidence for the type and all mandatory tasks done | X | E | "Add resolution evidence: {required items}." | C-5 |
| VR-34 | `On Hold – Customer` requires a customer-side reason from the list | X | E | "On Hold is only for waiting on the customer. Use a task or handoff for internal waits." | D-26 |

## Role × transition matrix (VR-27)

✓ = allowed · — = not allowed.

| Transition | CS (comm. owner) | Current resolution owner (SE / Finance / Ops City Manager) | KAM | Ops City Manager (as escalation contact) | System |
|---|---|---|---|---|---|
| Log (create `New`) | ✓ | ✓ (SE, KAM can log) | ✓ | ✓ | — |
| Complete Triage, set severity | ✓ | — | ✓ (account-level only) | ✓ | — |
| Hand off (`→ Assigned`) | ✓ | ✓ | ✓ | ✓ | — |
| Accept / return (`Assigned →`) | Receiver only | Receiver only | Receiver only | Receiver, or reassign as escalation contact | — |
| `→ On Hold – Customer` / resume | ✓ | — | ✓ (account-level) | — | Resume on time-out |
| `→ Awaiting Confirmation` (with evidence) | ✓ | ✓ | ✓ | ✓ | — |
| `→ Closed – Confirmed` | ✓ | — | ✓ (account-level: Plan Agreed) | — | ✓ only from a valid on-site sign-off (F-5) |
| `→ Closed – No Response` | — | — | — | — | ✓ (V2/V4 timers only) |
| `→ Closed – Cancelled` (duplicate / invalid) | ✓ with reason | — | ✓ with reason | ✓ with reason | — |
| Reopen | ✓ | — | ✓ | ✓ | — |
| Change final severity after Triage | ✓ with reason | — | — | ✓ with reason | — |

**Nobody** can move a case directly to `Closed – Confirmed` without resolution evidence (VR-33), including administrators. Corrections to closed cases are made by reopening.

## Error vs warning: the principle used
- **Hard errors** protect things that cannot be fixed later without harm:
  - a wrong customer–site link (repeat detection breaks);
  - missing invoice data at the Finance handoff (causes a return);
  - closure without evidence (C-5).
- **Warnings and soft blocks** cover things a person must judge:
  - a possible duplicate;
  - a recurrence;
  - a move date that suggests the invoice may be correct.

  A warning never stops an issue from being *logged* (C-1).
