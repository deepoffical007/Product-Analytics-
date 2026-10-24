# Assumptions Register

Rule: anything the brief does not state is an **assumption** (A) or a **proposed design decision** (see `decision_log.md`). Facts come only from the brief.

## Confirmed facts (from the brief, for reference)

| ID | Fact | Brief section |
|---|---|---|
| F-01 | 24+ cities, 2,000+ customer sites, ~40,000 services/month | The context |
| F-02 | Site types: corporate offices, manufacturing units, hospitals, schools, residential complexes | The context |
| F-03 | Complaint Management module is to be built **inside PadCareOne, the internal platform** | The context |
| F-04 | Six intake channels: SPOC WhatsApp to CS contact; generic support email inbox; phone call to CS; CS check-in call; KAM-forwarded escalation; verbal to SE on site | How complaints come in today |
| F-05 | Seven roles and their stated responsibilities (Client SPOC, End User, CS, SE, Ops City Manager, KAM, Finance) | Who is involved |
| F-06 | CS = owns client relationship, first responder. Ops City Manager = escalation when CS cannot resolve. KAM = involved when critical or repeat. Finance = billing, credit notes, invoice corrections | Who is involved |
| F-07 | Today: no single place to log, track, prioritise, analyse | The context |
| F-08 | Today CS marks resolved when they reply; no customer-confirmed closure | Challenge 5 |

## Assumptions

Columns: **Gap** (what the brief doesn't say) · **Assumption** · **Why needed** · **Validate with PadCare** · **Impact if wrong** (H/M/L).

| ID | Gap | Assumption | Why needed | Validate with | Impact if wrong |
|---|---|---|---|---|---|
| A-01 | Does PadCareOne hold customer and site master data? | Yes — customer accounts and sites exist as records in PadCareOne (it runs operations for 2,000+ sites). | Needed for customer–site lookup and validation at intake. | Product Lead | **H** — without it, validation becomes free text and repeat detection weakens |
| A-02 | Does PadCareOne hold service schedules / visit records? | Yes, at least a scheduled-service list per site with visit date and status. | Lets the form link a "missed collection" to a specific scheduled visit (S-01, S-04). | Product Lead / Ops | **H** — affects S-01 evidence and auto-verification |
| A-03 | Are invoices visible in PadCareOne? | No assumption of integration. Invoice number is entered manually by CS; Finance verifies. | S-02 needs an invoice reference. Safer not to assume a billing integration. | Finance | M |
| A-04 | Do channels (WhatsApp, email, phone) integrate with PadCareOne? | **No.** v1 = manual logging by the PadCare employee who receives the issue. | Brief says complaints are "handled informally" today; no integration is mentioned. | Product Lead | M — integration would reduce logging effort, not change the flow |
| A-05 | Can SEs use PadCareOne in the field? | SEs have a mobile view of PadCareOne (or a lightweight form) to log verbal complaints. | Channel 6 (verbal to SE) is otherwise the most likely to be lost (C-01). | Ops | M — fallback: SE reports to CS who logs it |
| A-06 | Is there a customer-facing portal? | **No.** Customers receive updates from CS via their existing channel (WhatsApp/email). Portal = future. | Brief calls PadCareOne "our internal platform". | Product Lead | M — changes C-07 solution, not the core flow |
| A-07 | Contractual SLAs with customers? | None known. All SLA targets are **proposals**. | Brief asks us to "propose reasonable timelines". | CS Lead / KAMs | M |
| A-08 | Service frequency per site | Varies; at least monthly for some sites (S-01: "this month"). | Defines how fast a missed collection becomes a hygiene risk. | Ops | M — affects severity rule |
| A-09 | Which CS person owns which customer? | Each customer account has a named primary CS owner, plus a city/team CS queue. | Needed for auto-assignment and for cover when the person is on leave (C-01). | CS Lead | **H** |
| A-10 | Is a KAM assigned to every customer? | No — only large enterprise accounts have a KAM (per role description). | Routing for S-05 differs if the account has no KAM. | Sales / KAM lead | M |
| A-11 | Who can approve credit notes? | Finance approves; CS cannot issue credit notes. | S-02 resolution path. | Finance | M |
| A-12 | Working hours / calendar for SLA clocks | SLAs measured in business hours (e.g., 9:00–18:00, Mon–Sat) except hygiene-critical issues, which run on calendar hours. | SLA arithmetic in Task 2. | Ops / CS | L |
| A-13 | Volume of complaints | Unknown. Not used to size anything; design must not depend on it. | Avoids inventing figures. | CS | L |
| A-14 | Is a site relocation (S-02) already reflected in master data? | Unknown — S-02 implies it may **not** be. Design treats "site moved but master not updated" as a real exception. | S-02 likely has a root cause in master data, not only in the invoice. | Finance / Ops | M |
| A-15 | Is there a CS Lead / CS manager role? | Not relied on — the brief does not list one. Escalations use only the roles in the brief. | Keeps routing within known roles. | CS | M — would be a natural owner for cover and unowned queues |
| A-16 | Does an additional unit change charges/contract? | Possibly; the service request flow includes an optional commercial approval by the KAM (or CS where there is no KAM). | S-03 fulfilment path. | Sales / Finance | M |
| A-17 | Complaints from before go-live | Not migrated. When a customer chases one, it is created then, flagged "not logged at receipt". | S-04 may refer to an issue that exists nowhere. | CS | L |
| A-18 | Who owns site master data (addresses, relocations)? | Unknown; the design routes corrections to a named "master data owner" role to be confirmed (likely Ops or Finance). | S-02 closure requires the site record to be fixed. | Product Lead | M |
| A-19 | Who is Finance's escalation contact? | Finance has a team lead or manager who can be named as the escalation contact. | Billing handoffs need an escalation target (C-04). | Finance | L |
| A-20 | Can an SE be sent to a site within 24 h, outside the planned route? | Yes, in most cities. Basis of the 24 h Hygiene-Critical target. | X1 resolution target. | Ops City Managers | **H** — if not, X1 must vary by city |
| A-21 | Can a visit be evidenced (photo / SPOC sign-off) from the field? | Yes, via the SE mobile view `[A-05]`. | Operational resolution evidence. | Ops | M — fallback: SPOC confirmation only |

## Open questions for the candidate (not PadCare)
Tracked in `project_plan.md` → "Questions for you".
