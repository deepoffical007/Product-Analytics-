# Decision Log

Format: decision · options considered · choice and why · trade-off · status.
Status: `Proposed` (AI-drafted, candidate not yet confirmed) · `Confirmed` (candidate agreed) · `Revised` · `Rejected`.

> Every `Confirmed` decision must be one the candidate can defend unaided in the 30–45 min walkthrough.

| ID | Decision | Options considered | Choice and why | Trade-off | Status |
|---|---|---|---|---|---|
| D-01 | How to build the submission | (a) One-shot generation; (b) Phased with review gates | **(b)** The brief evaluates reasoning, and the candidate is probed on decisions in a live walkthrough. | Slower | Confirmed (master prompt) |
| D-02 | Where to store the work | (a) Repo root; (b) Separate folder | **(b)** `padcare-assessment/`. The repo already contains an unrelated app (CEMS). | None | Proposed |
| D-03 | Commit the assessment PDF? | (a) Yes; (b) No | **(b)** It is PadCare's material, and the repo's visibility is unknown. Requirements are extracted into `requirements_matrix.md` instead. | Source must be re-uploaded for future sessions | Proposed |
| D-04 | Severity naming | (a) P1/P2/P3 or Critical/High/Low; (b) Named, PadCare-specific impact levels | **(b)** The brief explicitly lists "P1/P2/P3 tiers" under *What works against you*. Levels will be named by impact (e.g., hygiene risk vs service gap) and defined by observable rules. | Slightly less familiar to engineers; needs a definition table | Proposed |
| D-05 | Final document scope vs master-prompt working files | (a) Put everything in the doc; (b) Working files are deep, doc stays tight | **(b)** The brief says "Quality over volume" and penalises padding. The data model, analytics spec and traceability support the doc but are condensed or omitted. | Some good work is not visible to the reviewer; it can be shown in the interview | Proposed |
| D-06 | Umbrella term for what enters the register | (a) Everything is a "complaint"; (b) Neutral umbrella ("Case") with types | **Leaning (b)**, to be decided in Phase 1. Calling everything a "complaint" is the root of Challenge 3. The module keeps the brief's name ("Complaint Management"). | Renaming may look like overreach; must explain | Open → Phase 1 |
| D-07 | Task 2 complaint selection | (a) S-01 + S-02; (b) S-02 + S-05; (c) S-01 + S-05 | **Default (a)** per master prompt. Covers the two most common handoff chains (CS→SE/Ops and CS→Finance→CS). | S-05 (KAM flow) gets less depth | Awaiting candidate (Q-01) |
| D-08 | Test cases (Task 3) are written for which complaint? | S-02 or the other Task 2 pick | **S-02** — billing has the richest validations (invoice ref, site relocation, routing to Finance). | — | Proposed |
| D-09 | Channel integration in v1 | (a) Integrate WhatsApp/email; (b) Manual logging by receiver | **(b)** No integration is evidenced in the brief [A-04]. Process discipline first; integration later. | Logging effort for CS/SE; depends on adoption | Proposed |
