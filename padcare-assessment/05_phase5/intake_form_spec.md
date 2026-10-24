# Phase 5 — Task 3: Intake and Classification Form — Functional Specification

**Scope:** stages ST1 (Intake) and ST2 (Triage) of `02_phase2/end_to_end_flow.md` v1.1. Validation rule IDs (`VR-xx`) are defined in `validation_rules.md`; exception flows in `exception_handling.md`.

## 1. Form structure

One form in PadCareOne, filled in two steps by possibly different people `[D-15]`:

| Step | Who | Goal | Saves to status |
|---|---|---|---|
| **Log** | Whoever received the issue (CS, KAM, SE on mobile `[A-05]`) | Capture the issue in about 2 minutes; never lose it (C-1) | `New` |
| **Triage** | CS (account owner or city queue) | Complete the data; classify, link, set severity and route (C-2, C-3, C-8) | `New` → `Assigned` / `In Progress` |

**When a field is required** (column *Req.*):
- **L** — required to save the Log.
- **T** — required to complete Triage.
- **H** — required before the named handoff.
- **C** — conditional (see *Shown when*).
- **O** — optional.
- **S** — system-set (read-only).

**Status enquiries** use a short path: Log → link to the parent case → record the update. No Triage and no new case (§4).

## 2. Fields table

### 2.1 Identity and source (all case types)

| # | Field | Type · Source | Req. | Shown when | Notes, validation, default |
|---|---|---|---|---|---|
| 1 | Case ID | Text · system | S | Always | Format `PC-YYMM-NNNNN`; unique; assigned on save |
| 2 | Logged at / Logged by | Datetime, user · system | S | Always | Server time; current user |
| 3 | Channel | Dropdown · user | **L** | Always | WhatsApp to CS · Support email · Phone call to CS · CS check-in call · KAM escalation · SE on site · Other (requires text). **Default by logger role:** SE → "SE on site", KAM → "KAM escalation" |
| 4 | Received at | Datetime · user (default now) | **L** | Always | When the customer told PadCare; starts all SLA clocks `[D-25]`. Not in the future; ≤ Logged at (VR-05). More than R1 before now → info "will count as late registration" (VR-06). More than 30 days → reason required |
| 5 | Customer already acknowledged at | Datetime · user | O | Always | F-10. Between Received at and now (VR-29). Stored as a customer update; counts towards R3 only if a case reference was given |
| 6 | Source reference | Text · user | O | Channel = email / WhatsApp | Email subject or message ID; WhatsApp sender number |
| 7 | Attachments | Upload · user | O | Always | Screenshot, email file, photo. JPG, PNG, PDF, EML, MSG, DOCX, XLSX; ≤ 10 MB each; ≤ 5 files (VR-25) |

### 2.2 Customer, site, reporter

| # | Field | Type · Source | Req. | Shown when | Notes, validation, default |
|---|---|---|---|---|---|
| 8 | Customer account | Lookup (name / account code) · user | **L** | Always | Active customers from master `[A-01]`. **Not found** → "Unmatched customer" placeholder + *Customer name as stated* (text, L); Triage cannot complete until matched (VR-01) |
| 9 | Site | Lookup filtered by customer · user | **L** (operational, billing, service request); O (account-level) | Always | Must belong to the selected customer: **hard error** if not (VR-02). Not in the list → tick *Site not in list / customer says site changed* (field 10) |
| 10 | Site unverified | Checkbox + reason dropdown · user | C | Site not found or disputed | Reason: Site not in list · Customer says site moved · Other. Reveals *Site as stated by customer* (text, **L**). Warning, not a block (VR-03). Must be resolved at Triage: pick the correct site **or** create a master-data task `[A-18]` |
| 11 | City | Text · derived from site | S | Site chosen | Read-only; used for routing and reporting (C-6) |
| 12 | CS owner / KAM | User · derived from account | S | Always | Account CS owner (city CS queue if unavailable `[A-09]`); KAM if assigned `[A-10]` |
| 13 | Reporter | Lookup from account contacts, or new contact · user | **L** | Always | Name **L**; phone or email (at least one, VR-07); phone = 10-digit mobile (optional +91); valid email format |
| 14 | Reporter role | Dropdown · user | **L** | Always | Client SPOC · End User · Customer accounts/finance · Customer leadership · Other. **For communication only. Never an input to severity or priority (C-8).** Help text says so. If the reporter is not the SPOC, *Copy SPOC on updates* defaults to Yes |

### 2.3 Issue and classification

| # | Field | Type · Source | Req. | Shown when | Notes, validation, default |
|---|---|---|---|---|---|
| 15 | Customer's words | Long text · user | **L** | Always | Verbatim message or call summary; ≥ 10 characters (VR-08). Kept unchanged after Triage (audit) |
| 16 | Guided classification | 5 ordered Yes/No questions · user | **L** (best guess) / **T** (confirmed) | Always | Q1 already raised? → Q2 account-level response or trend? → Q3 invoice/charge/credit? → Q4 fix a committed service? → Q5 new or changed request? The first "Yes" sets field 17. Skipping ahead is allowed for experienced users; the questions are recorded |
| 17 | Case type | Dropdown · derived from 16, editable | **L** / **T** | Always | Status enquiry · Operational complaint · Billing complaint · Service request · Account-level concern. Change after Triage → reason required, event `reclassified` (VR-32) |
| 18 | Sub-category | Dependent dropdown · user | **T** | Type ≠ status enquiry | Operational: Missed collection · Late service · Unit not cleaned/odour · Unit overflowing · Unit damaged/missing · SE conduct · Other. Billing: Wrong amount · Wrong site/address · Charged for service not delivered · Duplicate invoice · Credit note pending · Other. Service request: Additional unit · Remove/relocate unit · Change schedule · Extra/one-off visit · Site details change · Document/information request. Account-level: Service quality trend · Multi-site issue · Commercial/pricing · Contract/renewal · Relationship escalation |
| 19 | Related cases panel | List · system | S | After customer + site | Open cases at the site; same site + sub-category in 90 days; account-level open cases. Triggers VR-11 / VR-12 |
| 20 | Links | Repeating: case lookup + link type · user/system | C | Any link made | Link type: Follow-up of · Duplicate of · Recurrence of (system-suggested) · Split from · Child of · Related. Linked case must be the same customer (VR-10) |
| 21 | Split: another independent need? | Yes/No · user | **T** | Always (except status enquiry) | Yes → "Create linked case" pre-fills customer, site, reporter, channel, received at, words; link type *Split from* (S-03) |

### 2.4 Type-specific fields

**Operational complaint**

| # | Field | Type · Source | Req. | Notes, validation |
|---|---|---|---|---|
| 22 | Location on site | Text · user | **T** | e.g., "4th floor washroom" (S-03); needed by the SE (VR-19) |
| 23 | Scheduled visit | Lookup of this site's visits in the last 60 days · user `[A-02]` | **T** for Missed collection / Late service; else O | Or tick "No scheduled visit found" → warning + Ops flag (VR-18) |
| 24 | Visit schedule status | Text · system (from 23) | S | If **Completed** while the sub-category = Missed collection → **data-integrity warning**; resolution later needs an Ops City Manager note (VR-18) |
| 25 | Days overdue | Number · system | S | Today − scheduled date; ≥ 3 → severity escalator (S-01) |
| 26 | Units affected | Number · user | O | ≥ 1 |

**Billing complaint**

| # | Field | Type · Source | Req. | Notes, validation |
|---|---|---|---|---|
| 27 | Invoice number | Text · user (lookup in v2 `[A-03]`) | **T**, **H** (Finance) | Alphanumeric with `-` and `/`, 4–30 characters (VR-13); format to confirm with Finance |
| 28 | Invoice month | Month picker · user | **T**, **H** | Not in the future; older than 12 months → warning (VR-14) |
| 29 | Disputed amount (₹) | Currency · user | C | Required (> 0) for Wrong amount, Charged for service not delivered and Duplicate invoice (VR-16) |
| 30 | Customer's expected outcome | Dropdown · user | **T** | Reissued invoice · Credit note · Explanation · Refund |
| 31 | Can the customer process this invoice? | Yes/No · user | **T** | Impact question for billing severity (F-1); No → Service-Impacting |
| 32 | Correct address / site | Text (or site lookup) · user | C → **H** (Finance) | **Required before the Finance handoff when the sub-category = Wrong site/address, or the site is flagged "moved"** (F-7, S-02) (VR-15) |
| 33 | Effective date of change | Date · user | C → **H** | Same condition. Not in the future. **After the invoice month** → warning: "the move post-dates this invoice — the invoice may be correct" (VR-15) |
| 34 | Other invoices possibly affected | Text · user | O | Hint: "since the effective date" (F-8) |

**Service request**

| # | Field | Type · Source | Req. | Notes, validation |
|---|---|---|---|---|
| 35 | Quantity | Number · user | C | Required (≥ 1) for Additional unit |
| 36 | Location on site | Text · user | **T** | Same as field 22 |
| 37 | Requested-by date | Date · user | **T** | ≥ today (VR-23) |
| 38 | Current problem reported? | Yes/No · user | **T** | Yes → **soft block**: create a linked operational complaint, or record why not (VR-22) (S-03 "overflowing daily") |
| 39 | Commercial approval needed | Yes/No · system default, CS-editable | S/T | Default Yes for Additional unit / Remove unit `[A-16]`; Yes → approval task to the KAM (CS if there is no KAM) |
| 40 | Committed date | Date · user | **T** | ≥ today; becomes the X3 target |

**Account-level concern**

| # | Field | Type · Source | Req. | Notes, validation |
|---|---|---|---|---|
| 41 | Sites affected | Multi-select of the account's sites + "Portfolio-wide" · user | **T** | ≥ 1 or "Portfolio-wide" (S-05) |
| 42 | Customer is asking for | Dropdown · user | **T** | Meeting · Review/report · Commercial change · Other |
| 43 | Preferred meeting window | Text · user | O | — |

### 2.5 Triage outcome (all case types except status enquiry)

| # | Field | Type · Source | Req. | Notes, validation |
|---|---|---|---|---|
| 44 | Hygiene exposure now? | Yes/No/Unknown · user | **T** (operational, account-level) | "Unknown" cannot complete Triage for an operational case: "Confirm with the customer whether units are full, overflowing or damaged" (VR-20). Shown with the reporter's words, but it is the **fact**, not the wording, that counts (S-01) |
| 45 | Sites affected (count) | Number · system (1, or count of field 41) | S | ≥ 3 → escalator |
| 46 | Recurrence count | Number · system | S | Same site + sub-category within 90 days; ≥ 2 previous → "Recurrence (n-th)" + escalator (VR-12) |
| 47 | System severity | Dropdown · system | S | Hygiene-Critical / Service-Impacting / Low-Impact from fields 31, 44, 45, 46, 25. Not shown for service requests `[D-17]` |
| 48 | Final severity | Dropdown · user (default = 47) | **T** | Different from 47 → *Override reason* required (VR-21). Downgrade from Hygiene-Critical → Ops City Manager notified |
| 49 | Priority | Computed · system | S | Severity → SLA state → flags → age `[D-20]` |
| 50 | Expedite | Checkbox + reason · KAM / Ops City Manager only | O | Reason required; reported (VR-28) |
| 51 | Next owner | User/queue · system-suggested by routing table | **T** | Hygiene-Critical operational → Ops City Manager (F-4); billing → Finance; etc. Handoff checklist by type (VR-31) |
| 52 | Acknowledgement sent | Datetime + text · user | **T** | Must include the case ref; logged as a customer update (R3) |

## 3. Conditions and dependencies (summary)

### 3.1 Required fields by case type

| Field group | Operational | Billing | Service request | Account-level | Status enquiry |
|---|---|---|---|---|---|
| Identity, channel, received at, reporter, words | L | L | L | L | L |
| Customer | L | L | L | L | L |
| Site | L | L | L | O → *Sites affected* T | L (prefills parent search) |
| Sub-category | T | T | T | T | — |
| Location on site | T | — | T | — | — |
| Scheduled visit | T (Missed/Late) | — | — | — | — |
| Invoice no. / month / expected outcome / can process | — | T + H | — | — | — |
| Correct address + effective date | — | H (Wrong site/address or "moved" flag) | — | — | — |
| Requested-by + committed date, current problem? | — | — | T | — | — |
| Hygiene exposure now? | T | — | — | T | — |
| Severity | T | T | **hidden** | T | inherits parent |
| Parent case | — | — | — | — | **L** (or "No existing case") |

### 3.2 Behaviour by channel
- **SE on site:** opened from the SE mobile view; the site is pre-filled from the current visit; a photo is suggested. If the SE has no access, CS logs with channel "SE on site" and the SE's name (VR-30).
- **KAM escalation:** reporter role is often "Customer leadership". The severity section shows the note *"Reporter role does not affect severity"* (C-8).
- **CS check-in call:** after saving, **"Add another issue from this call"** keeps the reporter, channel and received at pre-filled (one call, several cases).
- **Email / WhatsApp:** source reference shown; attachment prompt.

### 3.3 Dynamic behaviour
- Changing the **customer** clears the site, links and type-specific lookups, and re-runs VR-02, VR-11 and VR-12.
- Changing the **case type** keeps the shared fields and hides (does not delete) type-specific fields until Triage is saved.
- The **related cases panel** refreshes on any change to customer, site or sub-category.

## 4. Status enquiry path (form behaviour)
1. Type = Status enquiry → the form collapses to: customer, site (optional), reporter, channel, received at, words, **Parent case** (lookup: this customer's open cases plus those closed in the last 30 days, best matches first by site and sub-category).
2. A parent is selected → save creates a **follow-up on the parent**, not a case:
   - `followup_received` event;
   - parent flag "customer chased";
   - the parent's communication owner gets a task "update customer" due within R3.
3. If the parent is `Awaiting Confirmation` → prompt: "Ask whether it is resolved."
4. If the parent is `Closed` → the reopen / recurrence rules apply (`exception_handling.md` E-1).
5. "No existing case found" → the form converts to the full form for the underlying issue:
   - *Not logged at receipt* = Yes;
   - *Customer-stated original report date* is required and becomes Received at.

## 5. Task 3 Reasoning note (draft — rewrite in your own words)

> The hardest decision was customer–site validation: block or warn? Blocking guarantees clean data for repeat detection and reporting (C-2, C-6). But it means an issue that doesn't fit the master data is never logged (C-1), and S-02 *is* that case: the customer moved and our records didn't. So a missing or disputed site is a warning at Log that must be resolved at Triage. A site belonging to a different customer stays a hard error, because that is a wrong pick, not missing data. I applied the same logic to an unmatched customer. The trade-off: some records sit briefly with unverified data, which is why Triage has a short SLA.
