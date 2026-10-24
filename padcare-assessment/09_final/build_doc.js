const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, HeadingLevel,
  AlignmentType, WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak, Footer, PageNumber,
  TableLayoutType, VerticalAlign, LineRuleType,
} = require('docx');

const OUT_DIR = '/home/user/Product-Analytics-/padcare-assessment/09_final';
const W = 9638; // A4 content width in DXA with 2 cm margins
const TEAL = '0B6E6E', GREY = '5F6B76', LIGHT = 'EEF4F4', AMBER = 'FFF4CE', LINE = 'C9D3D9';

// ---------- inline formatting: **bold**, *italic*, `code` ----------
function runs(text, opts = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...opts }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...opts }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', ...opts, size: (opts.size || 20) - 2 }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...opts }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...opts }));
  return out;
}
const P = (text, o = {}) => new Paragraph({ children: runs(text, o.run || {}), spacing: { after: o.after ?? 100, before: o.before ?? 0 }, alignment: o.align, keepNext: o.keepNext });
const H1 = (t, pageBreak = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun(t)] });
const B = (text, lvl = 0) => new Paragraph({ numbering: { reference: 'bul', level: lvl }, children: runs(text), spacing: { after: 40 } });
const N = (text) => new Paragraph({ numbering: { reference: 'num', level: 0 }, children: runs(text), spacing: { after: 40 } });

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
function table(headers, rows, widthsPct, o = {}) {
  const total = o.width || W;
  const widths = widthsPct.map((p) => Math.round((p / 100) * total));
  widths[widths.length - 1] = total - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  const size = o.size || 16;
  const mk = (txt, i, head, shade) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    borders,
    shading: head ? { type: ShadingType.CLEAR, fill: LIGHT, color: 'auto' } : shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    verticalAlign: VerticalAlign.TOP,
    children: String(txt).split('\n').map((line) => new Paragraph({ children: runs(line, { size, bold: head || undefined }), spacing: { after: 20 } })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => mk(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, i, false, o.shadeFirst && i === 0 ? 'F7F9FA' : undefined)) })),
    ],
  });
}
const gap = (after = 80) => new Paragraph({ children: [], spacing: { after } });
function callout(label, text, fill = AMBER) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: fill === AMBER ? 'C99A00' : TEAL, space: 6 } },
    spacing: { before: 80, after: 120 },
    indent: { left: 120, right: 120 },
    children: [new TextRun({ text: label + ' ', bold: true, size: 19 }), ...runs(text, { size: 19 })],
  });
}
const draft = (text) => callout('[DRAFT — rewrite in your own words]', text);
const img = (file, wpx) => {
  const buf = fs.readFileSync(file);
  const h = buf.readUInt32BE(20), w = buf.readUInt32BE(16);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80, line: 240, lineRule: LineRuleType.AUTO }, keepNext: true,
    children: [new ImageRun({ type: 'png', data: buf, transformation: { width: wpx, height: Math.round(wpx * h / w) },
      altText: { title: 'Complaint flow', description: 'Simplified end-to-end complaint flow ST1-ST5', name: 'flow' } })] });
};

// ======================= CONTENT =======================
const c = [];

// ---------- Title page ----------
c.push(new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'PadCare Labs', color: GREY, size: 26 })] }));
c.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Complaint Management in PadCareOne', bold: true, size: 48, color: TEAL })] }));
c.push(new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Product Analyst (Process & Systems) — take-home assessment', size: 26 })] }));
c.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '[Candidate Name]', bold: true, size: 24, highlight: 'yellow' })] }));
c.push(new Paragraph({ spacing: { after: 900 }, children: [new TextRun({ text: '[Date]', size: 22, color: GREY, highlight: 'yellow' })] }));
c.push(H3('The design in five lines'));
c.push(B('**Every issue becomes a Case** logged by whoever receives it, owned by the account\'s CS owner from the first minute.'));
c.push(B('**Four case types** (operational, billing, service request, account-level) chosen by five ordered questions; a **status check is attached to its original case**, never a new complaint.'));
c.push(B('**Severity follows impact** (hygiene exposure now, service or billing commitment broken, repeat, scope), never who is asking.'));
c.push(B('**Ownership moves only when the receiver accepts**; the customer always hears from one CS owner.'));
c.push(B('**"Closed" needs evidence and the customer\'s confirmation**; returns within 14 days reopen the case.'));
c.push(gap(300));
c.push(H3('How to read this document'));
c.push(B('`[A-xx]` = assumption (Section 2). All SLA targets and thresholds are **proposals** to validate with PadCare.'));
c.push(B('**⚠** = a problem found while walking a complaint through the design (Task 2). **†** = Task 1 rule changed because of it.'));
c.push(B('Supporting working files (full field list, 34 validation rules, data model, metric definitions, audit) are available on request.'));

// ---------- 1. Problem & scope ----------
c.push(H1('1. Problem and scope', true));
c.push(P('PadCare cannot reliably answer four questions about any customer issue: **did we receive it, who owns it right now, is it actually fixed, has it happened before?** — nor, across issues, **where are we failing most?** The eight challenges reduce to four root causes, and the design targets those:'));
c.push(table(['Root cause', 'Challenges', 'Design response'], [
  ['Issue lives with a person, not a system', '1, 4, 7', 'Central register; receiver logs; owner from creation; tracked handoffs'],
  ['Every interaction is called a "complaint"', '3, 5, 6', 'Case types with their own owner, path and evidence of "done"'],
  ['No memory of history', '2, 6', 'History panel at intake; structured customer / site / category'],
  ['No shared meaning of "serious" or "done"', '5, 8', 'Impact-based severity; customer-confirmed closure'],
], [36, 14, 50]));
c.push(gap());
c.push(table(['In scope — v1', 'Deferred (why)'], [
  ['Central case register inside PadCareOne; manual logging from all 6 channels\nClassification, related-record search, impact severity, routing, handoffs, linked tasks\nLifecycle with evidence, customer confirmation, reopen\nCS-sent customer updates with a "maximum silence" timer\nStructured fields and an event log for reporting',
   'WhatsApp / email integration — none evidenced `[A-04]`; prove the process first\nCustomer self-service portal — PadCareOne is internal `[A-06]`\nInvoice issuing, field dispatch — existing processes; the module links to them\nAutomatic (AI) classification — needs the labelled history v1 creates'],
], [55, 45]));

// ---------- 2. Assumptions ----------
c.push(H1('2. Assumptions'));
c.push(P('Facts used come only from the brief. Everything below is assumed; the right-hand column says what changes if it is wrong.', { after: 80 }));
c.push(table(['ID', 'Assumption', 'Validate with', 'If wrong'], [
  ['A-01', 'PadCareOne holds customer and site master records', 'Product Lead', 'Validation and repeat detection fall back to free text'],
  ['A-02', 'PadCareOne holds the service schedule per site (date, status)', 'Product / Ops', 'Missed-collection cases cannot link to a visit'],
  ['A-03', 'Invoices are not in PadCareOne; CS enters the invoice number, Finance verifies', 'Finance', 'v2 could look invoices up'],
  ['A-04', 'No channel integrations; the receiver logs manually', 'Product Lead', 'Integration reduces effort, flow unchanged'],
  ['A-05', 'SEs have a mobile view to log issues and record visit evidence', 'Ops', 'SE calls CS, CS logs'],
  ['A-06', 'No customer portal; CS updates customers on their usual channel', 'Product Lead', 'Portal replaces the silence timer'],
  ['A-07', 'No contractual complaint SLAs exist; all targets are proposals', 'CS / KAMs', 'Contract terms override'],
  ['A-09', 'Every account has a named CS owner; a city CS queue covers leave', 'CS', 'Routing needs a queue owner'],
  ['A-10', 'Only large accounts have a KAM; otherwise the Ops City Manager handles account concerns', 'Sales / KAM', 'S-05 routing changes'],
  ['A-11', 'Only Finance issues corrections and credit notes; Finance has an escalation contact', 'Finance', '—'],
  ['A-12', 'Business hours 09:00–18:00 Mon–Sat; Hygiene-Critical runs on calendar hours', 'Ops / CS', 'SLA arithmetic shifts'],
  ['A-16', 'An additional unit may change charges, so it needs commercial approval', 'Sales / Finance', 'Approval step dropped'],
  ['A-18', 'Owner of site master data unknown; default = Ops City Manager of the city', 'Product Lead', 'S-02 correction task re-routed'],
  ['A-20', 'An SE can reach a site within 24 h in most cities', 'Ops City Managers', 'Hygiene-Critical target varies by city'],
], [8, 52, 15, 25]));

// ---------- 3. Challenges Map ----------
c.push(H1('3. Challenges Map'));
c.push(P('Step numbers refer to the flow in Section 4. ● addressed in v1 · ◐ partly (limitation stated).', { after: 80 }));
c.push(table(['#', 'Challenge', 'Design choice that addresses it', 'Where', ''], [
  ['1', 'Complaints lost between channels', '**Whoever receives it logs it** (≈2 min). Owned by the account CS owner from creation; city queue covers leave. A status check about an unlogged issue creates it, flagged *not logged at receipt*', '1.1–1.2, 2.2', '◐'],
  ['2', 'Repeat vs new unknown', '**History panel before classification.** Repeats suggested from the 2nd case; the **3rd in 90 days is flagged Recurrence**: severity up, root-cause note required', '2.1, 2.4', '●'],
  ['3', 'Everything called a "complaint"', '**4 case types** chosen by **5 ordered questions**; status check = follow-up on its parent; mixed messages **split into linked cases**', '2.2–2.3', '●'],
  ['4', 'No clear handoff', 'Handoff with reason + checklist; **sender accountable until the receiver accepts or returns**; silence escalates; other teams\' work as **linked tasks**', '3.1–3.4, 4.3', '●'],
  ['5', '"Resolved" ≠ resolved', '**Evidence required by type** before Awaiting Confirmation; closure needs the customer (or a defined no-response rule); return ≤14 days reopens', '4.4, 5.1–5.4', '●'],
  ['6', 'No patterns visible', 'Structured city / site / type / sub-category / severity + an event for every change → e.g. category share by city', 'ST6, §7', '●'],
  ['7', 'No customer visibility', 'CS updates at fixed points + **"maximum silence" timer**; chasing is counted', '2.6, R3–R6', '◐'],
  ['8', 'Severity by loudest voice', '**System proposes severity from impact answers**; seniority, tone, revenue are not inputs; overrides need a reason and are reported', '2.5', '●'],
], [4, 18, 58, 13, 7]));
c.push(P('**Limitations (◐):** 1 — still depends on people logging; lost issues become *visible and counted* when customers chase, and v2 inbox/WhatsApp capture removes the dependency. 7 — no self-service in v1; visibility depends on CS discipline, which the silence timer measures; v2 adds a read-only status link.', { before: 80, run: { size: 18 } }));

// ---------- 4. Task 1 ----------
c.push(H1('4. Task 1 — End-to-end complaint flow', true));
c.push(H2('4.1 Classification: what kinds of "complaint" exist'));
c.push(P('The five samples are traps if read by keyword: #4 mentions a missed service, #5 service quality, #2 a site move, #3 overflow. Classification therefore asks **what the customer needs PadCare to do**, in a fixed order — the first "yes" wins:', { after: 60 }));
c.push(table(['Order', 'Question', 'Result', 'Trap it prevents'], [
  ['1', 'Asking about an issue already raised?', 'Status check → follow-up on parent', '#4 becoming a duplicate complaint'],
  ['2', 'Wants an account-level response, or reports a trend across sites?', 'Account-level concern', '#5 becoming a vague complaint with nothing to fix'],
  ['3', 'About an invoice, charge or credit?', 'Billing complaint', '#2 logged as an address change Finance never sees'],
  ['4', 'Fix something PadCare already committed to?', 'Operational complaint', '—'],
  ['5', 'Something new or changed?', 'Service request', '#3 treated as a failure ("a service request in disguise")'],
  ['+', 'Second **independent** need with a different owner?', 'Create a linked case', '#3: overflow relief ≠ new unit'],
], [8, 38, 24, 30]));
c.push(gap());
c.push(table(['Type', 'Resolution owner', '"Resolved" means (evidence enforced)', 'Samples'], [
  ['Operational complaint', 'Scheduled SE; **Ops City Manager if Hygiene-Critical** † (SE visit as a task)', 'Visit recorded + photo or SPOC sign-off; missed collection also needs the next visit back on the schedule †', '#1, #3 (overflow)'],
  ['Billing complaint', 'Finance (CS before and after)', 'All affected invoices reissued / credit note / documented explanation + any site-record task done †', '#2'],
  ['Service request', 'Ops City Manager (+ KAM approval task if charges change)', 'Fulfilled (e.g. installation recorded) or declined with a reason', '#3 (new unit)'],
  ['Account-level concern', 'KAM (else Ops City Manager)', 'Meeting held; action plan with owners and review date; child cases for specific site failures', '#5'],
  ['Status check (not a case)', 'Parent\'s communication owner', 'Update sent and logged — **never closes the parent**', '#4'],
], [20, 27, 41, 12]));

c.push(H2('4.2 Severity and priority — impact, not volume'));
c.push(table(['Level', 'Observable test'], [
  ['**Hygiene-Critical**', 'A hygiene or health exposure exists at the site **now**: units full or overflowing, collection overdue, damaged or leaking unit'],
  ['**Service-Impacting**', 'An agreed service was not delivered properly, without current exposure; **or** an invoice the customer cannot act on (wrong amount, or wrong entity / site / address) †'],
  ['**Low-Impact**', 'No service, hygiene or financial consequence (cosmetic; invoice typo that does not stop processing)'],
], [22, 78]));
c.push(B('**Escalators (operational only)** † raise one level: 3rd case in 90 days at the site · same issue at 3+ sites · collection ≥3 days overdue. Billing never exceeds Service-Impacting — a billing repeat escalates to Finance and the KAM instead †.'));
c.push(B('**Who decides:** the system proposes from CS\'s impact answers and the schedule/history; CS confirms. Overrides need a reason; lowering Hygiene-Critical is visible to the Ops City Manager. **Reporter role is recorded for communication only.**'));
c.push(B('**Priority** is the computed queue order, not a second label: severity → time left on the SLA → flags (customer chased, resolution rejected, recurrence) → age. An *Expedite* flag exists for KAMs / Ops City Managers but needs a reason and is reported.'));

c.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, keepNext: true, children: [new TextRun('4.3 The flow (step numbers used throughout this document)')] }));
c.push(img(`${OUT_DIR}/flow_simplified.png`, 430));
c.push(P('**Statuses:** New → Assigned (handoff not yet accepted) → In Progress → On Hold – Customer (only when waiting on the customer; clock paused) → Awaiting Confirmation → Closed – *reason* (Confirmed · Confirmed on site · Plan Agreed · No Response · Cancelled – Duplicate / Invalid). Reopen is an event, not a status. Nobody — any role — can close without evidence.', { run: { size: 18 } }));

c.push(H2('4.4 Routing, ownership and handoffs'));
c.push(B('**Two owners:** a *resolution owner* who moves with the work, and a *communication owner* (CS) who stays — Finance can investigate without becoming the customer\'s contact.'));
c.push(B('**Handoff = reason + checklist + due time.** CS → Finance needs invoice no., month, disputed item, expected outcome, and for a wrong site the correct address + effective date. The **sender stays accountable until the receiver accepts**; the receiver may return it with a reason (back In Progress with the sender †). Not accepted in time → the receiver\'s escalation contact must **record a decision** (reassign / take over / new date) — no silent auto-reassignment.'));
c.push(B('**Linked tasks** † for work that does not change who decides (SE visit, site-record correction, commercial approval). Mandatory tasks block resolution.'));
c.push(B('**Escalation triggers:** handoff not accepted · SLA breached · 3rd recurrence · second customer rejection.'));

c.push(H2('4.5 Closure and verification'));
c.push(B('Evidence recorded → **Awaiting Confirmation**, owner back to CS, who tells the customer what was done and asks "is this resolved?". A sign-off by the reporter or SPOC on site counts as confirmation †.'));
c.push(B('**Rejects** → back to the last owner, SLA keeps running from receipt; 2nd rejection escalates. **No reply** after reminders on day 2 and 4 → *Closed – No Response* at day 5, reported separately from confirmed closures.'));
c.push(B('**Returns within 14 days** → reopen. Later → new case linked *Recurrence of*.'));

c.push(H2('4.6 SLAs (proposed)'));
c.push(P('Clocks start when **the customer told us** (late logging stays visible) and pause **only** while waiting on the customer (internal waits stay visible). Response targets tell the customer where things stand; resolution targets measure the fix.', { after: 60 }));
c.push(table(['Target', 'Hygiene-Critical', 'Service-Impacting', 'Low-Impact / request', 'Why'], [
  ['R1 Log (received → logged)', '1 h', '2 business h', '2 business h', 'Details are lost after a few hours'],
  ['R2 Triage (logged → classified)', '1 h', '4 business h', '1 business day', 'Severity is unknown until triage'],
  ['R3 Acknowledge with case ref', '2 h', 'Same day', 'Next business day', 'Before the customer thinks to chase'],
  ['R4 Accept a handoff', '1 h', '4 business h', '1 business day', 'Nothing sits for days (C4)'],
  ['R5 First ETA', '4 h', '1 business day', '2 business days', 'Customers chase when they have no ETA'],
  ['R6 Max silence while open', '1 day', '2 business days', '3 business days', 'Replaces a portal in v1 (C7)'],
  ['X1 Operational fix', '**24 h** (calendar)', '3 business days', '5 business days', 'Waste builds at weekends too; validate SE capacity `[A-20]`'],
  ['X2 Billing fix', '—', '5 business days', '7 business days', 'Corrected before the next invoice cycle'],
  ['X3 Service request', 'Committed date set at triage (default 10 business days for installation)', '', '', 'A promised date is more honest than a generic target'],
  ['X4 Account-level', 'Meeting ≤2 business days', 'Meeting ≤5; plan ≤10 business days', '—', 'Plan needs the account\'s case history'],
], [24, 15, 18, 17, 26]));

c.push(H2('4.7 Key decisions and trade-offs'));
c.push(table(['I chose…', 'over…', 'because…', 'accepting that…'], [
  ['"Case" with 4 types; status check attached to its parent', 'One "complaint" record with a type dropdown', 'Each type needs a different owner and meaning of "done"; status checks have no work of their own', 'Teams learn a new word'],
  ['Ordered classification questions', 'A flat dropdown', 'The samples are keyword traps (#2, #3, #4, #5)', 'A few seconds slower'],
  ['Two-step intake (fast Log, full Triage)', 'A complete form at first contact', 'A form slower than a WhatsApp reply will not be used (C1)', 'Records are briefly incomplete; R2 exposes stalls'],
  ['Ownership on acceptance', 'Ownership on assignment', 'A forwarded email is today\'s "handoff"', 'Senders carry slow receivers; escalation limits it'],
  ['Manager must record a decision on breach', 'Auto-reassign', 'Auto-reassign moves the problem, not the decision', 'Depends on managers acting (measured)'],
  ['Auto-close after no reply, reported separately', 'Keep open until the customer answers', 'Cases would stay open forever', 'Some unresolved issues close; reopen window covers it'],
], [27, 22, 31, 20]));
c.push(draft('The flow answers what PadCare can\'t today: did we get it, who owns it, is it fixed, has it happened before. The receiver logs it and a CS owner holds it from creation (C1). Ordered classification keeps status checks, requests and account concerns out of the complaint queue (C3). A history panel and recurrence rule surface repeats (C2, C6). Ownership moves only on acceptance (C4), closure needs evidence plus the customer\'s confirmation (C5), and severity follows hygiene impact and recurrence, not the reporter\'s seniority (C8). The weakest areas are C1 and C7: v1 still depends on people logging and updating.'));

// ---------- 5. Task 2 ----------
c.push(H1('5. Task 2 — Two complaints walked through the design'));
c.push(P('Times are **illustrative** (not PadCare data) and checked against the SLAs. Both walks were run on the first version of the flow; every ⚠ led to a fix now shown in Task 1 (†). Friction was added deliberately — a field SE who does not answer, Finance returning a case — because the happy path proves little.', { after: 80 }));

c.push(H2('5.1 Complaint #1 — "Collection was not collected this month… it\'s a hygiene issue."'));
c.push(P('**Intake (CS who received the WhatsApp):** customer, site, reporter (SPOC, facility manager), channel WhatsApp, received Mon 10:05, verbatim text + screenshot, guess = operational.', { run: { size: 18 } }));
c.push(table(['Time', 'Step', 'Owner · status', 'What happens', 'SLA'], [
  ['Mon 10:40', '1.2 Log', 'CS · New', 'Logged in ~2 min; customer and site valid', 'R1 35 min ✓'],
  ['10:45', '2.1 History', 'CS · New', 'One earlier missed collection 50 days ago (repeat #2, no flag yet). Schedule: this month\'s visit *Rescheduled* with no date', '—'],
  ['10:50', '2.2 Classify', 'CS · New', 'Not a status check, not account-level, not billing → **fix a committed service → Operational / Missed collection**. No duplicate, no split', '—'],
  ['11:05', '2.5 Severity', 'CS · New', 'CS asks the SPOC: bins full on two floors → exposure **yes**; 7 days overdue (escalator) → **Hygiene-Critical**. The word "hygiene" triggered the question; the facts answered it', 'R2 25 min ✓'],
  ['11:15', '2.6 Ack', 'CS · New', 'WhatsApp: case ref, "urgent, visit time by 2 pm"', 'R3 1 h 10 ✓'],
  ['11:20', '3.2 Handoff', 'CS accountable · Assigned', 'To SE-1 (scheduled SE) with location, access contact, severity', 'R4 due 12:20'],
  ['12:20', '4.3 Escalate', 'CS · Assigned', '**⚠ SE-1 on route, never accepted.** Escalated to the Ops City Manager, who reassigns to SE-2 at 12:45', 'Decision 25 min ✓'],
  ['12:55 → 16:50', '4.1 Act', 'SE-2 · In Progress', 'SE-2 accepts; CS sends ETA 16:30 (R5 ✓); collection done on all floors; photo; SPOC signs in the SE app', '—'],
  ['16:55', '4.4 Evidence', 'CS · Awaiting Conf.', 'Visit + photo + sign-off. **⚠ Nothing checks next month\'s visit is back on the schedule**', 'X1 6 h 50 ✓'],
  ['17:30 → Tue 09:40', '5.1–5.3', 'CS · Closed', '**⚠ CS asks "resolved?" although the SPOC already signed on site.** SPOC: "Yes, thanks" → Closed – Confirmed', '✓'],
], [11, 11, 15, 50, 13], { size: 15 }));
c.push(P('**Classification why:** an omission against a commitment (not a request); Hygiene-Critical on facts — the same result if a junior employee had politely reported it. **Ownership:** CS → (SE-1 never accepted) → Ops City Manager decision → SE-2 → CS. **Duration:** fixed in 6 h 50 against 24 h; closed in ~23.5 h. **Tested alternatives:** schedule shows *Completed* → data-integrity flag + Ops note; 3rd miss in 90 days → Recurrence + root-cause review; SPOC says "only 2 of 4 floors" → rejection, back to SE-2, clock still running.', { before: 80, run: { size: 18 } }));

c.push(H2('5.2 Complaint #2 — "Your invoice for September shows charges for the Hyderabad site, but we shifted… in July."'));
c.push(P('**Intake (CS on support-inbox duty — not the account owner):** customer, old Hyderabad site, reporter (SPOC, admin), channel email, received Wed 11:30, email text, guess = billing. Owner set automatically to the **account** CS owner (C1).', { run: { size: 18 } }));
c.push(table(['Time', 'Step', 'Owner · status', 'What happens', 'SLA'], [
  ['Wed 13:00', '1.2–1.3 Log', 'Account CS · New', 'Site exists but customer says it moved → **Unverified site** warning (does not block)', 'R1 1 h 30 ✓'],
  ['14:40', '2.2 Classify', 'CS · New', 'CS calls SPOC: services continue at the new site, amount right, but their accounts team **cannot process** an invoice with the old address → **Billing / Wrong site-address**', '—'],
  ['14:50', '2.5 Severity', 'CS · New', '**⚠ Two of my rules fit** ("billed incorrectly" vs "document error, amount unaffected"). CS picks Service-Impacting because the invoice is unusable', 'R2 ✓'],
  ['15:00–15:10', '2.6 / 3.2', 'CS accountable · Assigned', 'Ack email with case ref; handoff to Finance with invoice no., month, disputed item, expectation', 'R3 ✓'],
  ['16:30', '3.2 Return', 'CS', '**⚠ Finance returns: new address and effective date missing.** Case sits in Assigned and **the status model will not allow On Hold from there**; CS needs a workaround', '—'],
  ['16:45 → Thu 10:15', '4.2 Hold', 'CS · On Hold – Customer', 'Customer sends new address, effective 15 July; clock paused 2.5 business h', '—'],
  ['Thu 11:30', '3.2 Accept', 'Finance · In Progress', 'Re-handed with full data; Finance accepts; CS sends ETA "Monday"', 'R4 1 h ✓, R5 ✓'],
  ['Thu 15:00', '4.1 Act', 'Finance', '**⚠ July and August invoices also wrong** — the customer named only September. Root cause: site record never updated. **⚠ Finance has no in-system way to get it fixed without giving up ownership** → emails the Ops City Manager (today\'s behaviour)', '—'],
  ['Mon 12:00', '4.4 Evidence', 'CS · Awaiting Conf.', 'Three reissued invoice numbers + site-record change reference', 'X2 ~3.8 bd ✓'],
  ['Mon 14:00 → Wed', '5.1–5.3', 'CS · Closed', 'Invoices emailed; reminder day 2; customer: "Received, all fine" → Closed – Confirmed', '✓'],
], [11, 11, 15, 50, 13], { size: 15 }));
c.push(P('**Classification why:** the need is a corrected invoice → billing; the site record is PadCare\'s internal root cause, not a separate customer request. **Ownership:** account CS → (Finance returned) → CS on hold → Finance → CS. **Duration:** fixed in ~3.8 business days against 5; closed in 6. **Tested alternatives:** charges for a vacated site → credit note + Ops must explain visits recorded at an address the customer had left; Finance finds the invoice correct → documented explanation, two rejections escalate to the KAM.', { before: 80, run: { size: 18 } }));

c.push(H2('5.3 What the walkthroughs changed'));
c.push(table(['⚠ Found', 'Why it mattered', 'Change (version)'], [
  ['Two severity definitions fit #2', 'Same case, different severity depending on who triages — C8 returns', 'Billing severity = "can the customer act on the invoice?" (v1 †)'],
  ['Return left the case stuck in Assigned', 'A spec built literally blocks a real path', 'Return → In Progress with the sender (v1 †)'],
  ['Finance could only email for the site-record fix', 'Re-creates C4\'s forwarded emails inside the system', '**Linked tasks**: owner + due date, case owner stays accountable (v1 †)'],
  ['SE in the field did not accept within 1 h', 'The most urgent cases depended on the least reachable person', 'Hygiene-Critical → Ops City Manager owns, SE visit is a task (v1 †)'],
  ['SPOC confirmed twice', 'Irritates the customer, delays closure', 'Reporter / SPOC sign-off on site = confirmation (v1 †)'],
  ['Next visit never re-scheduled', 'Case closes while the cause continues', 'Missed-collection evidence includes the next scheduled visit (v1 †)'],
  ['Finance returned for missing data', 'Each return costs ~a day', 'Address + effective date mandatory before Finance handoff (Task 3)'],
  ['Only the named invoice would be fixed', 'Guarantees a second complaint', 'Finance checklist: all invoices since the effective date (v1 †)'],
  ['Nothing verifies the next invoice', 'Fix assumed, not verified', 'Automatic next-invoice check (**v2** — needs billing data)'],
], [30, 33, 37], { size: 15 }));
c.push(draft('Both cases met every proposed SLA, but walking them exposed gaps the diagram hides. Finance had no way to get the site record fixed without giving up ownership, so I added linked tasks. Finance\'s return showed the form must ask for the new address and effective date, and that my status model blocked On Hold after a return. A field SE could not realistically accept within an hour, so Hygiene-Critical visits now go to the Ops City Manager. And I had rated the same invoice error under two severity definitions, so I tightened the billing rule.'));

// ---------- 6. Task 3 ----------
c.push(H1('6. Task 3 — Intake form specification'));
c.push(P('One form, two steps. **L** = required to save the Log (kept to ~2 minutes) · **T** = required to complete Triage · **H** = required before the named handoff · **C** = conditional · **S** = system. Hard **errors** block; **soft blocks** force an explicit choice; **warnings** inform. No warning ever stops an issue being logged.', { after: 80 }));
c.push(H2('6.1 Key fields'));
c.push(table(['Field', 'Type · Source', 'Notes & validation'], [
  ['Case ID', 'Auto ID · system', 'S. `PC-YYMM-NNNNN`; read-only'],
  ['Channel', 'Dropdown · user', 'L. 6 brief channels + Other. Default by role (SE → "SE on site", KAM → "KAM escalation")'],
  ['Received at', 'Date-time · user (default now)', 'L. Starts every SLA clock. Not future, ≤ logged time (error). Beyond R1 → "late registration" warning; >30 days → reason'],
  ['Customer already acknowledged at', 'Date-time · user', 'Optional. Between received and now; counts for R3 only if a case ref was given'],
  ['Customer account', 'Lookup · user', 'L. Active customers. Not found → "Unmatched customer" + name as stated; **Triage blocked until matched**'],
  ['Site', 'Lookup filtered by customer · user', 'L (optional for account-level). **Must belong to the customer — hard error.** Not in list / moved → tick *Site unverified* + *site as stated* (warning); Triage must pick the right site or raise a site-record task'],
  ['City, CS owner, KAM', 'Derived · system', 'S. From site / account; drive routing and reporting'],
  ['Reporter + contact', 'Lookup or new contact · user', 'L. Phone (10 digits) or email required'],
  ['Reporter role', 'Dropdown · user', 'L. SPOC / End user / Accounts / Leadership / Other. **For communication only — never an input to severity**'],
  ['Customer\'s words', 'Long text · user', 'L. Verbatim, ≥10 characters; unchanged after triage'],
  ['Classification Q1–Q5 → Case type', 'Yes/No questions · user; type derived', 'L as a guess, T confirmed. Change after triage needs a reason'],
  ['Sub-category', 'Dependent dropdown · user', 'T. List per type (e.g. Billing: wrong amount, wrong site/address, charged for service not delivered, duplicate, credit note pending)'],
  ['Parent case', 'Lookup · user', 'Status check only, L: this customer\'s open + recently closed cases. Or "No existing case" → full form, *not logged at receipt* flag'],
  ['Related cases / links', 'System panel; link lookup + type · user', 'Open cases at site; same site + sub-category in 90 days. Same customer only (error). Open match → **soft block "Same incident?"**'],
  ['Second independent need?', 'Yes/No · user', 'T. Yes → linked case pre-filled (#3)'],
  ['Location on site', 'Text · user', 'T for operational and service requests ("4th floor washroom")'],
  ['Scheduled visit · days overdue', 'Lookup · user; overdue · system', 'T for missed / late service. Schedule says *Completed* → data-integrity warning (#1). Overdue ≥3 days → escalator'],
  ['Invoice number · invoice month', 'Text, month · user', 'T and H (Finance). 4–30 chars; month not in future; >12 months → warning'],
  ['Disputed amount · expected outcome', 'Currency, dropdown · user', 'Amount >0 required for wrong amount / duplicate / not delivered. Outcome T (reissue / credit note / explanation / refund)'],
  ['Can the customer process this invoice?', 'Yes/No · user', 'T (billing). No → Service-Impacting'],
  ['Correct address · effective date', 'Text, date · user', '**H (Finance) when sub-category = wrong site/address or site flagged "moved"** (#2). Date ≤ today; after invoice month → warning "invoice may be correct"'],
  ['Quantity · requested-by · committed date', 'Number, dates · user', 'T (service request). Dates ≥ today; committed date is the X3 target'],
  ['Current problem reported?', 'Yes/No · user', 'T (service request). Yes → **soft block**: create linked operational complaint or give reason (#3 "overflowing daily")'],
  ['Sites affected · customer asks for', 'Multi-select, dropdown · user', 'T (account-level, #5). ≥1 site or "portfolio-wide"; meeting / review / commercial change'],
  ['Hygiene exposure now?', 'Yes / No / Unknown · user', 'T (operational, account-level). **Unknown cannot complete triage** — "confirm whether units are full, overflowing or damaged" (#1)'],
  ['System / final severity', 'Derived; dropdown · user', 'T. Hidden for service requests; billing max Service-Impacting. Override → reason (error); lowering Hygiene-Critical notifies Ops City Manager'],
  ['Recurrence count · priority', 'Computed · system', 'S. 3rd case in 90 days → Recurrence flag'],
  ['Attachments', 'Upload · user', 'JPG, PNG, PDF, EML, MSG, DOCX, XLSX; ≤10 MB; ≤5. A bad file is rejected alone — the form still saves'],
], [24, 22, 54], { size: 15 }));

c.push(H2('6.2 Conditions and dependencies'));
c.push(table(['Required', 'Operational', 'Billing', 'Service request', 'Account-level', 'Status check'], [
  ['Channel, received, customer, reporter, words', 'L', 'L', 'L', 'L', 'L'],
  ['Site', 'L', 'L', 'L', 'Sites affected T', 'L'],
  ['Sub-category · severity', 'T · T', 'T · T (≤ S-I)', 'T · hidden', 'T · T', '— · inherits'],
  ['Type-specific', 'Location, scheduled visit, hygiene exposure', 'Invoice no./month, outcome, can process; address + date (H)', 'Quantity, dates, current problem', 'Sites, asks for, hygiene exposure', 'Parent case (L)'],
], [24, 17, 19, 15, 14, 11], { size: 15 }));
c.push(B('**By channel:** SE on site → site pre-filled from the current visit, photo prompt; KAM escalation → note "reporter role does not affect severity"; check-in call → "add another issue from this call" keeps reporter and channel.'));
c.push(B('Changing the customer clears the site and links and re-runs the site and repeat checks. Changing type hides (does not delete) type-specific fields until saved.'));
c.push(B('**Handoff checklists** block the move: Finance needs invoice data (+ address/date for a wrong site); SE / Ops needs location, access contact, severity.'));

c.push(H2('6.3 Exception cases'));
c.push(P('**Status check (#4)**', { after: 20, keepNext: true }));
c.push(B('Parent open → follow-up, priority raised, CS "update customer" task due within R3; **no new case, parent status unchanged**.'));
c.push(B('Parent awaiting confirmation → ask if resolved. Closed ≤14 days and not fixed → reopen. Closed earlier → new case linked *Recurrence of*.'));
c.push(B('No parent → the issue was lost: full form, *not logged at receipt*, received = customer-stated date. Parent of another customer → error.'));
c.push(P('**Repeat complaint**', { after: 20, keepNext: true }));
c.push(B('Open case, same site + sub-category → soft block: *same incident (follow-up)* / *same incident, second reporter* (saved as Cancelled – Duplicate, linked, reporter added to parent) / *different incident*.'));
c.push(B('Resolved earlier, back within 90 days → suggested *Recurrence of* link; 3rd → flag, escalator, root-cause note. **Never merged automatically.**'));
c.push(P('**Wrong site or customer**', { after: 20, keepNext: true }));
c.push(B('Site of another customer → hard error. Site missing or moved (#2) → warning at Log, resolved at Triage (correct site or site-record task). Customer missing → "Unmatched customer"; triage blocked until matched.'));
c.push(B('Wrong pairing found after triage → CS corrects with a reason; SLA clocks unchanged; repeat checks re-run.'));
c.push(P('**Also handled:** multiple issues in one message (split rule) · invalid attachments · unauthorised status changes (role matrix; closure without evidence impossible for any role) · customer non-response (reminders, then No Response) · reopening after closure.', { run: { size: 18 } }));

c.push(H2('6.4 Test cases — Complaint #2 (billing)'));
c.push(P('Data: customer *Acme* (fictional), old site HYD-014 (Acme), HYD-022 (another customer), invoice for Sep, move effective 15 Jul; CS-B logs from the inbox, CS-A owns the account, FIN-1 in Finance.', { run: { size: 17 } }));
c.push(table(['ID', 'Test', 'Steps', 'Expected result'], [
  ['TC-01', 'Valid billing complaint (positive)', 'CS-B logs the email (received 11:30), HYD-014. CS-A triages: Q3 yes; wrong site/address; invoice no. + month; outcome reissue; can process = No; address + 15 Jul; complete', 'Case ID created; status New; **owner = CS-A, not CS-B**; clocks from 11:30; type Billing; **severity Service-Impacting**; no hygiene question; suggested owner Finance'],
  ['TC-02', 'Missing invoice information (negative)', '(1) Complete triage without invoice no. (2) Add it; hand off without effective date. (3) Enter 15 Oct. (4) Correct to 15 Jul', '(1) Blocked, stays New. (2) Triage completes, **handoff blocked** listing missing items. (3) Warning "move after invoice month", not blocking. (4) Handoff succeeds; no handoff event before (4)'],
  ['TC-03', 'Invalid customer–site (negative)', '(1) Acme + HYD-022; save. (2) Tick "customer says site moved" + stated address; save. (3) Complete triage. (4) Pick HYD-014 + raise site-record task', '(1) **Hard error**, nothing saved. (2) Saves with unverified warning. (3) Blocked until resolved. (4) Completes; mandatory task in Ops City Manager\'s queue'],
  ['TC-04', 'Possible repeat (edge)', 'Open case -0031: same site, wrong site/address. Log the SPOC\'s email; choose "same incident — second reporter". Variant: 2 closed similar cases in 90 days', 'Soft block shows -0031; no auto-merge. New record Cancelled – Duplicate, linked; SPOC added to -0031; **-0031 unchanged**. Variant: Recurrence flag; **severity stays Service-Impacting**; Finance escalation + KAM informed'],
  ['TC-05', 'Routing to Finance (positive + negative)', 'Hand off; FIN-1 returns ("need PO ref"); CS-A re-hands; no acceptance within 4 business h; FIN-1 accepts', 'Assigned with **CS-A accountable**; return → In Progress with CS-A; R4 breach escalates to Finance escalation contact; on accept **owner FIN-1, communication owner still CS-A**; never ownerless'],
  ['TC-06', 'Premature closure prevented (negative)', 'CS-A tries to close; FIN-1 tries Awaiting Confirmation without invoice ref, then with ref but task open; task done; customer asks "any update?"; FIN-1 tries to close; customer confirms', 'Each attempt blocked with the missing item; after task done → Awaiting Confirmation, owner CS-A; status check adds follow-up, **status unchanged**; FIN-1 cannot close; **Closed – Confirmed only at the last step**'],
], [8, 17, 37, 38], { size: 15 }));
c.push(draft('The hardest decision was customer–site validation: block or warn? Blocking keeps repeat detection and reporting clean (C2, C6), but an issue that does not fit our master data would never be logged (C1) — and #2 is exactly that: the customer moved and our records did not. So a missing or disputed site is a warning at Log that must be resolved at Triage, while a site belonging to another customer stays a hard error, because that is a wrong pick, not missing data. The cost is records that are briefly unverified, which the short triage SLA limits.'));

// ---------- 7. Data ----------
c.push(H1('7. Data that makes patterns visible (C6)'));
c.push(P('Five additions to PadCareOne (customer, site, contact and schedule are reused): **Case**, **Case link** (duplicate / recurrence / split / child), **Case task**, **Attachment**, and one append-only **Case event** log (every status, owner, handoff, customer update, follow-up, severity change and escalation, time-stamped). One log answers every metric and is the audit trail. Rules enforced in data: an open case always has both owners; a site must belong to the case\'s customer; a confirmed closure needs evidence; status checks never create cases.', { after: 80 }));
c.push(table(['Metric (all proposed — no baseline exists)', 'Definition', 'Challenge'], [
  ['Category share by city', 'Complaints of a sub-category in a city ÷ all complaints in that city (by received date) — answers "40% missed services in one city?"', '6'],
  ['Repeat rate', 'Complaints with ≥1 earlier same site + sub-category case in 90 days ÷ all complaints', '2'],
  ['Time in Assigned · return rate', 'Hours from handoff to accept/return; returns ÷ handoffs, by receiving team', '4'],
  ['Customer-confirmed closure · reopen rate', 'Confirmed ÷ valid closed; reopened within 14 days ÷ closed (cohort)', '5'],
  ['Chase rate · silence breaches', 'Cases with ≥1 status check ÷ cases; cases breaching R6', '7'],
  ['Severity overrides by reporter role', 'Overrides ÷ triaged, split by up/down and reporter role — **is "loudest wins" creeping back?**', '8'],
  ['Not logged at receipt', 'Cases created only when a customer chased ÷ all cases', '1'],
], [28, 62, 10], { size: 15 }));
c.push(P('Durations reported as median and 90th percentile; cancelled cases and status checks excluded from complaint counts.', { before: 60, run: { size: 17 } }));

// ---------- 8. Trade-offs & limitations ----------
c.push(H1('8. Trade-offs, limitations and v2'));
c.push(table(['Limitation in v1', 'Mitigation / next step'], [
  ['Logging still depends on people (C1)', 'Lost issues counted when customers chase · **v2:** capture from the support inbox, then WhatsApp Business'],
  ['No customer self-service (C7)', 'Silence timer + chase metric · **v2:** read-only status link by case reference'],
  ['Thresholds (24 h visit, 3 days overdue, 3 sites, 3rd in 90 days) are guesses', 'Calibrate after 2–3 months of module data; review overrides'],
  ['More load on Ops City Managers (Hygiene-Critical ownership)', 'Validate volumes per city; a city dispatcher role if needed'],
  ['Auto-closed "no response" cases may hide unresolved issues', 'Reported separately; 14-day reopen; SE check on next visit for Hygiene-Critical'],
  ['#3 and #5 checked by design review only, not by a timed walkthrough', 'Next walkthroughs to run; #5 is the most likely to expose gaps (multi-city ownership)'],
  ['Next invoice after a billing fix is not verified', '**v2:** automatic check once billing data is in PadCareOne'],
  ['Owner of site master data unknown `[A-18]`', 'Confirm with PadCare; default = Ops City Manager'],
], [45, 55], { size: 16 }));

// ---------- 9. Final design review ----------
c.push(H1('9. Final design review'));
c.push(P('Before submission every part was cross-checked against the others. Beyond the walkthrough findings (Section 5.3), writing the test cases and a consistency audit found and fixed:', { after: 60 }));
c.push(B('**A 3rd billing complaint would have become Hygiene-Critical** through the recurrence escalator — meaningless for an invoice. Escalators now apply to operational complaints only; billing escalates instead.'));
c.push(B('**The "3+ sites" escalator would have made #5 Hygiene-Critical** with no hygiene exposure — same fix.'));
c.push(B('**"Recurrence" meant two things** (a link from the 2nd case, a flag from the 3rd), so the repeat rate and the warning counted differently. Now: *repeat* from the 2nd case, *Recurrence flag* from the 3rd.'));
c.push(B('**"Customer not found → block"** would have lost issues from new or misspelled customers; replaced by an unmatched-customer placeholder that blocks only triage.'));
c.push(B('Closure reasons, step numbers and routing text unified across all sections.'));
c.push(P('**Check result:** all five sample complaints run end to end; all eight challenges map to specific steps (two partly by design); every PadCare capability used is listed as an assumption.', { before: 80 }));

// ======================= DOCUMENT =======================
const doc = new Document({
  creator: 'Candidate',
  title: 'PadCare — Complaint Management in PadCareOne',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20 }, paragraph: { spacing: { line: 264 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: TEAL }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL, space: 2 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, color: '1F2328' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 21, bold: true, color: TEAL }, paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } } ] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1020, bottom: 1020, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'PadCare — Complaint Management design · page ', size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY })] })] }) },
    children: c,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(`${OUT_DIR}/PadCare_Complaint_Management_Assessment.docx`, buf);
  console.log('docx written', buf.length);
});
