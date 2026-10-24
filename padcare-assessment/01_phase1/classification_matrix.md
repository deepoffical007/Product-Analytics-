# Phase 1 — Classification Matrix

## 1. Record model `[D-10]` `[D-11]`

Everything logged becomes a **Case** of one of four types. A **status enquiry is not a case**: it is logged as a *follow-up entry* on the case it refers to.

| Case type | Definition (one test) | Typical sub-categories (v1, extendable) | Default resolution owner | Communication owner | "Resolved" means (evidence) |
|---|---|---|---|---|---|
| **Operational complaint** | PadCare did not deliver, or delivered badly, something it **already committed to** | Missed collection/service · Late service · Unit not cleaned/odour · Unit overflowing · Unit damaged/missing · SE conduct · Other | CS triages → **SE** for the visit; **Ops City Manager** on escalation | CS | Corrective action done and verified: visit completed and recorded, with proof (e.g., photo or SPOC sign-off) `[A-02]` |
| **Billing complaint** | Disagreement with an **invoice, charge, payment or credit** | Wrong amount · Wrong site/address · Charged for service not delivered · Duplicate invoice · Credit note pending · Other | CS triages → **Finance** investigates → back to CS | CS | Corrected invoice or credit note issued (reference recorded), **or** a documented explanation that the invoice is correct |
| **Service request** | Customer asks for something **new or changed** relative to what is agreed; nothing has failed | Additional unit · Remove/relocate unit · Change schedule · Extra/one-off visit · Site details change · Document request | CS → **Ops City Manager** (fulfilment); KAM approval if commercial terms change `[A-16]` | CS | Request fulfilled (e.g., installation completed and recorded) or formally declined with a reason |
| **Account-level concern** | Customer wants a **relationship-level response** (review, meeting, commercial change), or describes a **trend across sites** rather than one incident to fix | Service quality trend · Multi-site issue · Commercial / pricing · Contract / renewal · Relationship escalation | **KAM**; if no KAM → Ops City Manager of the primary city `[A-10]` `[A-15]` | CS (KAM may communicate directly) | Agreed action plan recorded, with a named owner and review date; customer agrees the plan |
| *Status enquiry* (not a case) | Customer asks about the progress of an issue **already raised** | — | Communication owner of the parent case | CS | Update sent and logged. **Never closes the parent case** |

**Severity applies to operational complaints, billing complaints and account-level concerns.** Service requests have a *requested-by date*, not a severity. If the request carries a current impact, that impact becomes a linked operational complaint (see S-03). Severity levels and rules are defined in `02_phase2/end_to_end_flow.md` §2.5.

### Additional types evaluated and rejected

| Candidate | Decision | Why |
|---|---|---|
| Compliment / feedback | Not in v1 | Not part of the brief's problem; adds a type nobody owns |
| Safety / health incident | Not a separate type | It is an operational complaint at the highest severity; a separate type would split the hygiene data (C-06) |
| Information / how-to query | Sub-category of service request ("Document / information request") | Low volume (assumed), same owner as a service request |
| Invalid / not for PadCare | Not a type; a **closure reason** ("Cancelled — invalid / not PadCare") | Something has to be logged before it can be judged invalid |

## 2. Classification decision table (asked in this order) `[D-12]`

The order matters: each question catches a sample complaint that a later question would misclassify.

| Step | Question to the logger | If YES | What the step protects against |
|---|---|---|---|
| **1** | Is the customer asking about an issue they **already raised**? | **Status enquiry.** Search for the parent case → attach a follow-up (see §4) | S-04 mentions "missed service"; without this step it becomes a duplicate operational complaint |
| **2** | Is the customer asking for an **account-level response** (meeting, review, commercial change), or describing a **trend across sites** with no single incident to fix? | **Account-level concern** | S-05 mentions "service quality"; without this step it becomes a vague operational complaint with nothing to fix |
| **3** | Is it about an **invoice, charge, payment or credit**? | **Billing complaint** | S-02 mentions a site move; without this step it may be logged as a "site details change" service request and Finance never sees it |
| **4** | Is the customer asking PadCare to **fix or make up for something already committed** (missed, late, poor, broken, conduct)? | **Operational complaint** | — |
| **5** | Is the customer asking for something **new or changed**? | **Service request** | S-03 is a request, not a failure (the brief: "a service request in disguise") |
| **6 (always)** | Split check: does the message contain a **second need that is independent** (could be resolved on its own) and needs a **different owner or closure condition**? | Create a second case and **link** them | S-03: overflow relief ≠ new unit installation |

**Split rule detail.** *Independent* needs become separate linked cases. *Dependent* needs become actions inside the primary case.
- Example of a dependent need: "service was missed **and** you charged us for it". This is one operational complaint, with a Finance credit-note action **if** the miss is confirmed. The billing outcome depends on the operational finding.

## 3. The five sample complaints

| | S-01 Missed collection | S-02 Invoice, relocated site | S-03 Additional unit | S-04 "Has my complaint been resolved?" | S-05 Quality drop, multiple sites |
|---|---|---|---|---|---|
| **Decided at step** | 4 | 3 | 5 (+6 split) | 1 | 2 |
| **Case type** | Operational complaint | Billing complaint | Service request **+ linked** operational complaint | Status enquiry → follow-up on the parent case | Account-level concern |
| **Sub-category** | Missed collection | Wrong site/address (triage may change this to "Charged for service not delivered", see below) | SR: Additional unit · OC: Unit overflowing | — (parent: Missed collection) | Service quality trend |
| **What the customer needs** | A collection visit now | Corrected invoice | (a) New unit on 4th floor; (b) overflow stopped now | An update, and the original issue fixed | A meeting and a credible improvement plan |
| **Impact signals** (inputs to severity, Phase 2) | Collection overdue against schedule; customer reports a hygiene risk (to be **verified**, not taken from the wording, C-08) | Financial; no hygiene impact | Daily overflow = current hygiene exposure at one location | Customer already chased once; no update was given | Multiple sites; quality trend; relationship risk |
| **Severity** (Phase 2 rules) | **Hygiene-Critical** if units are full or the collection is ≥ 3 days overdue; else Service-Impacting. The customer's wording is not used on its own | **Service-Impacting** (billed incorrectly; no hygiene exposure) | OC: **Hygiene-Critical** (overflow = current exposure) · SR: none (committed date instead) | Inherits the parent's; **priority** raised by the "customer chased" flag | Highest severity among the account's open cases; else **Service-Impacting** (quality trend) |
| **Resolution owner path** | CS → SE (visit) → CS; Ops City Manager if the visit SLA is at risk | CS → Finance → CS | SR: CS → Ops City Manager (+ KAM if commercial) `[A-16]` · OC: CS → SE (interim extra collection) | Parent case's current owner; CS replies | KAM (or Ops City Manager if no KAM) |
| **Closure evidence** | Visit recorded as completed + proof; customer confirms | Corrected invoice/credit note reference **and** site record corrected so next month's invoice is right; customer confirms | SR: installation recorded; OC: overflow controlled (interim + capacity fixed); each confirmed separately | Update sent and logged; the parent case stays open | Action plan agreed + review date; customer agrees |
| **Repeat check** | Missed collections at this site in the look-back window | Billing complaints for this account/site; **likely to recur monthly** until the site record is fixed | Earlier overflow complaints at this site (may show under-capacity) | *Is* the repeat lookup: find the parent | Pull all cases across the account's sites; the evidence base for the meeting |
| **Triage question to resolve** | Was the visit scheduled? Does the system show it as *done*? (If "done" but not collected → a data-integrity / SE issue, investigate) | **Address only** (re-issue invoice), **or** charges for a site no longer occupied (credit note + check whether services were really performed July–Sept)? | Does the extra unit change charges (needs approval)? Is the existing schedule being met? | Does the parent exist? Is it open? Was it closed without confirmation? | Does the account have a KAM? Which sites and cities? |

### Notes the walkthroughs (Phase 4) must test
- **S-02 hides a master-data problem.** If the site record still holds the old address, every future invoice will be wrong. That would generate a repeat billing complaint each month. Closure must require the site record to be corrected, not just the September invoice. *Who owns site master data is unknown; validate with PadCare.*
- **S-03's two cases close separately.** The complaint can close once overflow is controlled, even if installation takes weeks. If they were one case, either the overflow waits for the installation, or the case closes before the installation happens.
- **S-04 is evidence of a design failure, not a new issue.** It means the customer was not updated. It should count against update performance (C-07), and it may expose a complaint that was never logged (C-01).
- **S-05 should spawn child cases.** If the meeting surfaces specific failing sites, each becomes an operational complaint linked to the account concern, so each one is actually fixed.

## 4. Status enquiry handling (S-04 pattern)

| Situation found on search | Action | Data recorded |
|---|---|---|
| Parent found, **open** | Attach a follow-up; CS sends an update within the acknowledgement SLA (Phase 2); raise the parent's priority | Follow-up count +1; "customer chased" flag |
| Parent found, **awaiting customer confirmation** | Treat as a confirmation conversation: ask whether it is resolved | Confirmation outcome |
| Parent found, **closed**, customer says not fixed | **Reopen** the parent (if within the reopen window) or create a new case linked as a **recurrence** | Reopen count / recurrence link |
| **No parent found** | The original was never logged (lost, C-01). Create the underlying case now, with the **customer-stated original report date** and a "not logged at receipt" flag | Lost-complaint indicator for O1 |

## 5. Distinguishing status enquiry vs duplicate vs recurrence `[D-14]`

| Situation | Test | Handling |
|---|---|---|
| **Status enquiry** | Same issue, customer asking for progress | Follow-up on the parent, no new case |
| **Duplicate** | Same incident logged twice (e.g., SPOC on WhatsApp **and** an End User by email) | Second record is closed as "Duplicate of #…", linked; its contact details are added to the parent |
| **Recurrence** | Same customer + site + category, but the earlier case was **resolved** and the issue happened again | New case, linked as a recurrence; repeat count shown; feeds severity/escalation (Phase 2) |
| **Related but different** | Same site, different category | Shown as context only; no link required |

## 6. Ambiguity test (are the rules unambiguous?)

New, made-up messages run through the decision table to check the rules hold up.

| # | Test message | Step | Result | Rules held? |
|---|---|---|---|---|
| T1 | "The bin wasn't cleaned last week and you still charged us." | 4 | Operational complaint; credit note as a **dependent action** (split rule) | Yes |
| T2 | "Please move the unit from the 2nd to the 3rd floor." | 5 | Service request: relocate unit | Yes |
| T3 | "Any update on the extra bin we asked for?" | 1 | Status enquiry on a **service request** parent | Yes — status enquiries apply to all types |
| T4 | "Three of our sites missed collection this week." | 4 | Three operational complaints (one per site) | **Partly.** Is it also an account concern? Rule: only if the customer asks for an account-level response. Each site still needs fixing → per-site cases. If KAM involvement is wanted, link them to an account concern. Watch in Phase 4 |
| T5 | "We'd like to reduce the price for next year." | 2 | Account concern: commercial | Yes |
| T6 | "Your SE was rude to our staff." | 4 | Operational complaint: SE conduct | Yes. Severity rules must cover non-hygiene impact (Phase 2) |
| T7 | "The odour is back again." | 4 | Operational complaint; the repeat check finds earlier odour cases → recurrence | Yes |
| T8 | End User emails directly; the SPOC also WhatsApps the same issue | 4 | First = case; second = **duplicate**, linked | Yes, depends on the duplicate check at Log |
| T9 | "Can you send a copy of the August invoice?" | 5 | Service request: document request (not a billing complaint, as nothing is disputed) | Yes |
| T10 | Customer complains about a site that is not theirs in the master data | — | Not a type question: a **customer–site validation exception** (Phase 5) | Out of classification scope |

**Result:** 9 of 10 classify cleanly. T4 (multi-site, specific incidents) is the one grey area. The tie-break rule is written above and flagged for the Phase 4 stress test.
