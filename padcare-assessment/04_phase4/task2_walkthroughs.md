# Phase 4 — Task 2: Two Complaints Walked Through the Design

- **Selection:** S-01 (missed collection, operational) and S-02 (billing, satisfies the "#2 or #5" rule) `[D-07]`.
- **Step references** (1.2, 2.5, R4…) are to `02_phase2/end_to_end_flow.md` and `sla_matrix.md`.
- **Times are illustrative**, chosen to be realistic within the proposed SLAs. They are **not** PadCare performance data. Business hours: 09:00–18:00 Mon–Sat `[A-12]`.
- **⚠ F-x** marks where the walkthrough exposed a problem. Findings and fixes are in `design_review.md`.

---

## Walkthrough A — S-01: "Collection was not collected this month. Please plan the visit ASAP, as it's a hygiene issue."

**Setting (illustrative):** a corporate office site; monthly collection; the Client SPOC (facility manager) WhatsApps their CS contact.

### Intake captured at 1.2 (by the CS person who received the WhatsApp)
- **Customer, site:** looked up from master data.
- **Reporter:** SPOC — name, phone, role "Facility manager".
- **Channel:** WhatsApp to CS.
- **Received at:** Day 1 (Mon) 10:05, taken from the message timestamp.
- **Customer's words:** verbatim, with a screenshot.
- **Logger's best guess:** Operational complaint.

### Timeline

| Time | Step | Accountable owner | Status | What happens | SLA check |
|---|---|---|---|---|---|
| D1 10:05 | 1.1 | — | — | WhatsApp received by the CS owner | Clocks start (received at) |
| D1 10:40 | 1.2–1.3 | CS (account owner) | `New` | Logged in about 2 min; customer and site valid | R1 (1 h for Hygiene-Critical, HC): 35 min ✓ |
| D1 10:45 | 2.1 | CS | `New` | Related-record panel: no open cases. **One earlier missed collection at this site 50 days ago** (repeat count 2: suggested *Recurrence of* link; the Recurrence flag starts at the 3rd). Schedule shows this month's visit (due on the 6th) as *Rescheduled* with no new date `[A-02]` | — |
| D1 10:50 | 2.2–2.3 | CS | `New` | Q1 no (new issue) → Q2 no → Q3 no → **Q4 yes: PadCare missed a committed service → Operational complaint / Missed collection**. No duplicate. "Plan the visit" is the fix itself, not a second need → no split | — |
| D1 11:05 | 2.5 | CS | `New` | Impact questions. *Hygiene exposure now?* CS asks the SPOC: bins full on two floors → **yes**. *Overdue?* 7 days past schedule (escalator ≥ 3 days). **Severity = Hygiene-Critical.** The customer's word "hygiene" triggered the question, but the **answer came from facts** (C-8) | R2 (1 h from log): 25 min ✓ |
| D1 11:15 | 2.6 | CS | `New` | Acknowledgement on WhatsApp: case ref, "missed collection, marked urgent; visit time by 2 pm"; logged as a customer update | R3 (2 h): 1 h 10 ✓ |
| D1 11:20 | 3.1–3.2 | **CS** (until acceptance) | `Assigned` → SE-1 | Routed to SE-1, the site's scheduled SE. Checklist: site, floors, access contact, severity, problem | R4 deadline 12:20 |
| D1 12:20 | 4.3 | CS | `Assigned` | **SE-1 has not accepted**: on route, phone not checked. Auto-escalation to the **Ops City Manager** ⚠ F-4 | R4 breached → decision due in 1 h |
| D1 12:45 | 4.3 | CS | `Assigned` → SE-2 | Ops City Manager records the decision: *reassign to SE-2* (nearby route) | Decision in 25 min ✓ |
| D1 12:55 | 3.2 | **SE-2** | `In Progress` | SE-2 accepts on mobile `[A-05]`; ownership transfers | — |
| D1 13:05 | R5 | SE-2 (CS communicates) | `In Progress` | CS sends the ETA: "visit today 16:30" | R5 (4 h): 3 h ✓ |
| D1 16:30–16:50 | 4.1 | SE-2 | `In Progress` | Collection done on all floors; photo; **SPOC signs off in the SE app** `[A-21]` | — |
| D1 16:55 | 4.4 | SE-2 → **CS** | `Awaiting Confirmation` | Evidence recorded: visit record + photo + sign-off. Ownership returns to CS. ⚠ F-6: nothing checks that **next month's** visit is back on the schedule | X1 (24 h): 6 h 50 ✓ |
| D1 17:30 | 5.1 | CS | `Awaiting Confirmation` | CS sends the photo and asks "Is this resolved?" ⚠ F-5: the SPOC already signed off on site; asking again is duplicate effort | V1 (same day for HC) ✓ |
| D2 09:40 | 5.2–5.3 | CS | `Closed – Confirmed` | SPOC: "Yes, thanks." CS closes with reason *Confirmed* | Within V2 ✓ |

### Classification rationale (why)
- **Operational, not a service request:** the customer asks PadCare to make good a missed commitment, not to add anything.
- **Hygiene-Critical** because the bins were full (exposure now) and the visit was 7 days overdue. It would be the same severity if a junior employee had reported it politely.
- **Priority:** top of the city queue (HC + R4 breach flag).

### Ownership trail
CS (New) → CS accountable while assigned to SE-1 → Ops City Manager decides → **SE-2** (In Progress) → **CS** (Awaiting Confirmation) → Closed.
CS was the communication owner throughout.

### Duration
- **Fix:** 6 h 50 (target 24 h).
- **Closure:** about 23.5 h.
- The SE escalation cost about 1.5 h of the fix time.

### Alternative paths tested
| If… | Then… |
|---|---|
| The schedule shows the visit as **Completed** but the customer says it was not | Data-integrity flag (4.1): cannot be resolved without an Ops City Manager note; a possible SE-conduct case is created and linked |
| Bins are not full and the visit is only 1 day overdue | Service-Impacting; X1 = 3 business days; added to the next route |
| This was the **3rd** missed collection in 90 days | Recurrence → severity already at maximum; Ops City Manager root-cause review; KAM informed if it is a KAM account |
| SPOC replies "only 2 of 4 floors collected" | Rejected → `In Progress` with SE-2; rejection count 1; the SLA continues from the original receipt |

---

## Walkthrough B — S-02: "Your invoice for September shows charges for the Hyderabad site, but we shifted to a new location in July. Please correct the address."

**Setting (illustrative):** a multi-site corporate customer; the SPOC emails the generic support inbox.

### Intake captured at 1.2 (by the CS person on inbox duty — *not* the account's CS owner)
- **Customer:** looked up.
- **Site:** Hyderabad site (the old record).
- **Reporter:** SPOC — email, role "Admin / facilities".
- **Channel:** support email.
- **Received at:** D1 (Wed) 11:30.
- **Customer's words:** email text pasted.
- **Logger's best guess:** Billing.

### Timeline

| Time | Step | Accountable owner | Status | What happens | SLA check |
|---|---|---|---|---|---|
| D1 11:30 | 1.1 | — | — | Email arrives in the support inbox | Clocks start |
| D1 13:00 | 1.2–1.3 | **Account CS owner** (auto) | `New` | The inbox-duty CS logs it. Site exists, but the customer says it moved → **"Unverified site" warning** (not blocking). The case lands with the account's CS owner, not the inbox person (C-1) | R1 (2 business h): 1 h 30 ✓ |
| D1 14:30 | 2.1 | CS | `New` | Panel: no open cases; no billing cases in 90 days. Schedule: services Jul–Sep recorded against the Hyderabad site record | — |
| D1 14:40 | 2.2 | CS | `New` | **Triage question from Phase 1:** address only, or charges for a vacated site? CS calls the SPOC: services continue at the new location, the amount is right, but **their accounts team cannot process an invoice with the old address**. Q1 no → Q2 no → **Q3 yes → Billing complaint / Wrong site-address** | — |
| D1 14:50 | 2.5 | CS | `New` | Impact: no hygiene exposure; invoice is wrong. ⚠ F-1: the Low-Impact definition ("document error with no effect on amount") and the Service-Impacting definition ("billed incorrectly") **both fit**. CS chooses **Service-Impacting** because the invoice is unusable | R2 (4 business h from log) ✓ |
| D1 15:00 | 2.6 | CS | `New` | Acknowledgement email: case ref; Finance will correct; next update by tomorrow | R3 (same day) ✓ |
| D1 15:10 | 3.2 | **CS** (until acceptance) | `Assigned` → Finance | Handoff checklist: invoice no. (Sept), disputed item = billing address, expectation = reissued invoice, customer email attached | R4 (4 business h) |
| D1 16:30 | 3.2 | CS | `Assigned` | **Finance returns it:** "new address and effective date missing" ⚠ F-7. As designed, the case is back with CS in `Assigned`. **CS cannot put it On Hold from `Assigned`** — the state diagram only allows On Hold from `In Progress` ⚠ F-2. Workaround: CS moves it to `In Progress`, then On Hold | — |
| D1 16:45 | 4.2 | CS | `On Hold – Customer` | CS emails the SPOC for the new address and move date. Clock paused | — |
| D2 10:15 | 4.2 | CS | `In Progress` | Customer replies: new address, effective **15 July**. Clock resumes (paused 2 h 30 business time) | — |
| D2 10:30 | 3.2 | CS | `Assigned` → Finance | Re-handoff with complete information | R4 deadline 14:30 |
| D2 11:30 | 3.2 | **Finance** | `In Progress` | Finance accepts | R4: 1 h ✓ |
| D2 12:00 | R5 | Finance (CS communicates) | `In Progress` | CS update: "corrected invoice by Monday" | R5 (1 business day + hold) ✓ |
| D2 15:00 | 4.1 | Finance | `In Progress` | Finance finds that the **July and August** invoices also carry the old address; the customer only mentioned September ⚠ F-8. Root cause: the **site master record was never updated** `[D-18]` | — |
| D2 15:15 | 4.4 | Finance | `In Progress` | Finance needs the site record corrected by its owner (assumed the Hyderabad Ops City Manager `[A-18]`). **The only tool is a handoff, which would move ownership away from Finance.** Finance emails the Ops City Manager instead — today's informal behaviour ⚠ F-3 | — |
| D3 (Fri) 15:00 | — | Finance | `In Progress` | Site record updated: new address, effective 15 July | — |
| D5 (Mon) 12:00 | 4.4 | Finance → **CS** | `Awaiting Confirmation` | Reissued Jul/Aug/Sep invoices (numbers recorded) + master-data change reference = evidence | X2 (5 business days): ~3.8 business days net of hold ✓ |
| D5 14:00 | 5.1 | CS | `Awaiting Confirmation` | CS emails the reissued invoices; asks the customer to confirm | V1 ✓ |
| D7 (Wed) 10:00 | 5.2 | CS | `Awaiting Confirmation` | Automatic reminder 1 (day 2) | — |
| D7 15:20 | 5.3 | CS | `Closed – Confirmed` | Customer: "Received, all fine." Closed | Within V2 ✓ |

### Classification rationale (why)
- **Billing, not a service request** to change site details: the customer's need is a corrected invoice.
  - The site-record fix is PadCare's internal root cause. It is not a separate customer request.
- **Service-Impacting:** the customer cannot use the invoice. The rule wording had to be stretched to reach this (F-1).
- **No severity escalator applied.** The fact that three invoices were affected only surfaced during investigation.

### Ownership trail
CS (New) → CS accountable while assigned to Finance → returned to CS → CS (On Hold – Customer) → CS → **Finance** (In Progress, with an untracked request to the Ops City Manager) → **CS** (Awaiting Confirmation) → Closed.

### Duration
- **Resolution:** about 3.8 business days net of the 2.5 h customer hold (target 5).
- **Closure:** 6 business days.
- The missing-information return cost most of a day.

### Alternative paths tested
| If… | Then… |
|---|---|
| The customer was charged for services at the **vacated** site | Sub-category → *Charged for service not delivered*; Finance issues a credit note; **Ops must explain why visits were recorded at an address the customer had left** (data-integrity flag, linked operational case) |
| Finance finds the invoice correct (e.g., the move was never notified) | Evidence = documented explanation; CS communicates it; if the customer rejects twice → escalate (KAM if the account has one) |
| The customer never confirms | Reminders at day 2 and 4 → `Closed – No Response` at day 5; reported separately |
| The October invoice is wrong again | Recurrence (new billing case linked). With the master fixed, this should not happen; v2 automatic check (F-9) |

---

## Task 2 Reasoning note (draft — rewrite in your own words)

> Both cases met every proposed SLA, but walking them exposed gaps the flow diagram hides. The billing case had no clean way for Finance to get the site record fixed without giving up ownership. So I added linked tasks: work by another team that does not move accountability. Finance's return for missing information showed the intake form must ask for the new address and effective date when the sub-category is a wrong site. It also showed my state diagram blocked "On Hold" after a return. In the missed collection, a field SE could not realistically accept within an hour, so Hygiene-Critical visits now route to the Ops City Manager to dispatch. I also caught myself rating an address-only invoice error under two different severity definitions, and tightened the billing definition.

Word count: ~120 (≈ 6–7 lines at A4 width). Trim further if needed.
