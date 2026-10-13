import { addDays, addMonths, currentPeriod, isWorkingDay, monthEnd, monthStart, parseISODate, toISODate, today, workingDaysBetween } from '@/lib/dates';
import { createRng, type Rng } from '@/lib/random';
import { computePayroll } from './payroll-calc';
import type {
  Announcement,
  AttendanceRecord,
  AuditLog,
  Candidate,
  CandidateStage,
  Database,
  Department,
  Designation,
  Employee,
  EmploymentStatus,
  EmploymentType,
  Holiday,
  JobOpening,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Notification,
  OnboardingItem,
  PayrollRecord,
  PerformanceReview,
  ReviewStatus,
  Settings,
  User,
} from './types';

export const DB_VERSION = 3;

export const DEFAULT_LEAVE_POLICY: Record<LeaveType, number> = {
  casual: 12,
  sick: 10,
  earned: 15,
  academic: 7,
  other: 5,
};

export const DEMO_USERS = {
  admin: 'u-admin',
  hr: 'u-hr',
  head: 'u-head',
  faculty: 'u-faculty',
} as const;

const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#ef4444', '#64748b', '#0891b2'];

const FEMALE = ['Aarti', 'Kavya', 'Neha', 'Pooja', 'Riya', 'Sneha', 'Divya', 'Ishita', 'Meghna', 'Shruti', 'Tanvi', 'Lakshmi', 'Swati', 'Nandini', 'Anjali', 'Farah', 'Sana', 'Deepa', 'Rekha', 'Gauri', 'Madhuri', 'Sunita', 'Pallavi', 'Bhavna', 'Zoya', 'Harini', 'Jyoti', 'Kiran', 'Revathi', 'Simran'];
const MALE = ['Arjun', 'Rohan', 'Aditya', 'Karan', 'Rahul', 'Siddharth', 'Varun', 'Nikhil', 'Manish', 'Suresh', 'Rajesh', 'Amit', 'Imran', 'Harish', 'Gaurav', 'Prakash', 'Anil', 'Deepak', 'Sanjay', 'Vivek', 'Kunal', 'Mohit', 'Tarun', 'Faisal', 'Abhishek', 'Naveen', 'Ravi', 'Sameer', 'Yash', 'Joseph'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Menon', 'Reddy', 'Gupta', 'Patel', 'Joshi', 'Kulkarni', 'Banerjee', 'Chatterjee', 'Das', 'Singh', 'Khan', 'Mehta', 'Pillai', 'Rao', 'Nair', 'Desai', 'Bhat', 'Kaur', 'Fernandes', 'Mishra', 'Agarwal', 'Saxena', 'Chopra', 'Thomas', 'Hegde', 'Naidu', 'Malhotra', 'Bose', 'Qureshi'];
const CITIES = ['Pune', 'Bengaluru', 'Hyderabad', 'Chennai', 'Nagpur', 'Indore', 'Bhopal', 'Lucknow', 'Jaipur', 'Kochi'];
const STREETS = ['MG Road', 'Station Road', 'Lake View Colony', 'Shivaji Nagar', 'Gandhi Path', 'Nehru Enclave', 'Model Town', 'Park Street', 'Civil Lines', 'University Road'];

interface DeptSeed {
  code: string;
  name: string;
  kind: 'academic' | 'admin';
  spec: string[];
  description: string;
}

const DEPARTMENTS: DeptSeed[] = [
  { code: 'CSE', name: 'Computer Science & Engineering', kind: 'academic', spec: ['Machine Learning', 'Distributed Systems', 'Cyber Security', 'Data Engineering', 'Computer Networks', 'Software Engineering'], description: 'UG and PG programmes in computing, AI and software engineering.' },
  { code: 'ECE', name: 'Electronics & Communication', kind: 'academic', spec: ['VLSI Design', 'Embedded Systems', 'Signal Processing', 'Wireless Communication'], description: 'Electronics, communication systems and embedded design.' },
  { code: 'ME', name: 'Mechanical Engineering', kind: 'academic', spec: ['Thermal Engineering', 'Robotics', 'Manufacturing', 'Fluid Mechanics'], description: 'Design, manufacturing, thermal and robotics labs.' },
  { code: 'CE', name: 'Civil Engineering', kind: 'academic', spec: ['Structural Engineering', 'Geotechnics', 'Environmental Engineering', 'Transportation'], description: 'Structures, environment and infrastructure.' },
  { code: 'MATH', name: 'Mathematics', kind: 'academic', spec: ['Applied Mathematics', 'Statistics', 'Operations Research'], description: 'Core mathematics and statistics for all programmes.' },
  { code: 'SCI', name: 'Applied Sciences', kind: 'academic', spec: ['Physics', 'Chemistry', 'Materials Science'], description: 'Physics, chemistry and materials science.' },
  { code: 'HUM', name: 'Humanities & Languages', kind: 'academic', spec: ['English Literature', 'Economics', 'Communication Skills'], description: 'Languages, economics and professional communication.' },
  { code: 'MGT', name: 'Management Studies', kind: 'academic', spec: ['Finance', 'Marketing', 'Human Resource Management', 'Operations'], description: 'MBA programme and executive education.' },
  { code: 'ADM', name: 'Administration & Registry', kind: 'admin', spec: [], description: 'Principal’s office, registry and general administration.' },
  { code: 'HRD', name: 'Human Resources', kind: 'admin', spec: [], description: 'Recruitment, onboarding, employee relations and policy.' },
  { code: 'FIN', name: 'Finance & Accounts', kind: 'admin', spec: [], description: 'Budgeting, payroll processing, fees and audits.' },
  { code: 'LIB', name: 'Library & Information Services', kind: 'admin', spec: [], description: 'Central library, digital resources and archives.' },
  { code: 'EXM', name: 'Examination Cell', kind: 'admin', spec: [], description: 'Examination scheduling, evaluation and results.' },
  { code: 'ITS', name: 'IT Services', kind: 'admin', spec: [], description: 'Campus network, ERP, labs and help desk.' },
];

const DESIGNATIONS: Omit<Designation, 'status'>[] = [
  { id: 'des-principal', title: 'Principal', category: 'faculty', grade: 1 },
  { id: 'des-prof', title: 'Professor', category: 'faculty', grade: 2 },
  { id: 'des-assoc', title: 'Associate Professor', category: 'faculty', grade: 3 },
  { id: 'des-asst', title: 'Assistant Professor', category: 'faculty', grade: 4 },
  { id: 'des-lect', title: 'Lecturer', category: 'faculty', grade: 5 },
  { id: 'des-visit', title: 'Visiting Faculty', category: 'faculty', grade: 5 },
  { id: 'des-registrar', title: 'Registrar', category: 'administrative', grade: 2 },
  { id: 'des-finoff', title: 'Finance Officer', category: 'administrative', grade: 3 },
  { id: 'des-hrm', title: 'HR Manager', category: 'administrative', grade: 3 },
  { id: 'des-ao', title: 'Administrative Officer', category: 'administrative', grade: 4 },
  { id: 'des-librarian', title: 'Librarian', category: 'administrative', grade: 4 },
  { id: 'des-sysadmin', title: 'System Administrator', category: 'administrative', grade: 4 },
  { id: 'des-examco', title: 'Examination Coordinator', category: 'administrative', grade: 4 },
  { id: 'des-hre', title: 'HR Executive', category: 'administrative', grade: 5 },
  { id: 'des-accountant', title: 'Accountant', category: 'administrative', grade: 5 },
  { id: 'des-asstlib', title: 'Assistant Librarian', category: 'administrative', grade: 5 },
  { id: 'des-labtech', title: 'Lab Technician', category: 'administrative', grade: 6 },
  { id: 'des-office', title: 'Office Assistant', category: 'administrative', grade: 6 },
];

const SALARY: Record<string, [number, number]> = {
  'des-principal': [215000, 215000],
  'des-prof': [148000, 172000],
  'des-assoc': [108000, 128000],
  'des-asst': [68000, 88000],
  'des-lect': [45000, 54000],
  'des-visit': [38000, 42000],
  'des-registrar': [118000, 125000],
  'des-finoff': [92000, 98000],
  'des-hrm': [94000, 94000],
  'des-ao': [62000, 70000],
  'des-librarian': [60000, 66000],
  'des-sysadmin': [68000, 76000],
  'des-examco': [54000, 60000],
  'des-hre': [40000, 46000],
  'des-accountant': [48000, 54000],
  'des-asstlib': [36000, 40000],
  'des-labtech': [28000, 33000],
  'des-office': [21000, 24000],
};

const QUAL: Record<string, string[]> = {
  faculty: ['Ph.D.', 'M.Tech, Ph.D.', 'M.E.', 'M.Sc, Ph.D.', 'M.Tech', 'MBA, Ph.D.', 'M.A., Ph.D.'],
  administrative: ['B.Com', 'M.Com', 'MBA (HR)', 'B.Sc', 'MCA', 'M.Lib.Sc', 'Diploma', 'B.A.', 'CA (Inter)'],
};

function holidaysFor(year: number): Holiday[] {
  const md: [string, string][] = [
    ['01-26', 'Republic Day'],
    ['03-04', 'Holi'],
    ['04-03', 'Good Friday'],
    ['05-01', 'Labour Day'],
    ['08-15', 'Independence Day'],
    ['10-02', 'Gandhi Jayanti'],
    ['10-20', 'Dussehra'],
    ['11-09', 'Diwali'],
    ['12-25', 'Christmas'],
  ];
  return md.map(([d, name]) => ({ date: `${year}-${d}`, name }));
}

const round500 = (n: number) => Math.round(n / 500) * 500;

export function createSeedDatabase(seed = 20261013): Database {
  const rng = createRng(seed);
  const now = new Date().toISOString();
  const t = today();
  const year = parseISODate(t).getFullYear();
  const holidays = [...holidaysFor(year - 1), ...holidaysFor(year), ...holidaysFor(year + 1)];

  const settings: Settings = {
    institutionName: 'Northfield Institute of Technology',
    institutionShort: 'NIT',
    leavePolicy: { ...DEFAULT_LEAVE_POLICY },
    workdayStart: '09:00',
    lateAfter: '09:15',
    holidays,
    currency: 'INR',
  };

  const departments: Department[] = DEPARTMENTS.map((d) => ({
    id: `dept-${d.code.toLowerCase()}`,
    code: d.code,
    name: d.name,
    headId: null,
    status: 'active',
    description: d.description,
    createdAt: '2012-06-01T09:00:00.000Z',
  }));
  const deptByCode = (c: string) => departments.find((d) => d.code === c)!;

  const designations: Designation[] = DESIGNATIONS.map((d) => ({ ...d, status: 'active' }));

  // ---- Employees -----------------------------------------------------------
  const employees: Employee[] = [];
  const usedEmails = new Set<string>();
  let seq = 1001;

  const makeEmail = (first: string, last: string) => {
    const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    let email = `${base}@northfield.edu.in`;
    let n = 2;
    while (usedEmails.has(email)) email = `${base}${n++}@northfield.edu.in`;
    usedEmails.add(email);
    return email;
  };

  const randomDob = (minAge: number, maxAge: number) => {
    const y = year - rng.int(minAge, maxAge);
    return toISODate(new Date(y, rng.int(0, 11), rng.int(1, 28)));
  };

  const randomJoin = (fromYear: number) => {
    const y = rng.int(fromYear, year);
    let d = toISODate(new Date(y, rng.int(0, 11), rng.int(1, 28)));
    if (d > t) d = addDays(t, -rng.int(20, 300));
    return d;
  };

  const docsFor = (rngx: Rng, joining: string): Employee['documents'] => {
    const recent = joining > addDays(t, -120);
    const st = (): 'Verified' | 'Pending' | 'Missing' => (recent ? rngx.pick(['Verified', 'Pending', 'Missing'] as const) : rngx.chance(0.92) ? 'Verified' : 'Pending');
    return [
      { id: 'doc-id', name: 'Aadhaar / Government ID', type: 'Identity', status: 'Verified', uploadedAt: joining },
      { id: 'doc-pan', name: 'PAN Card', type: 'Identity', status: st(), uploadedAt: joining },
      { id: 'doc-deg', name: 'Highest Degree Certificate', type: 'Academic', status: st(), uploadedAt: joining },
      { id: 'doc-offer', name: 'Signed Offer Letter', type: 'Employment', status: 'Verified', uploadedAt: joining },
      { id: 'doc-relieve', name: 'Previous Employer Relieving Letter', type: 'Employment', status: st(), uploadedAt: joining },
    ].map((d) => ({ ...d, uploadedAt: d.status === 'Missing' ? null : d.uploadedAt })) as Employee['documents'];
  };

  function addEmployee(p: {
    first?: string;
    last?: string;
    gender?: Employee['gender'];
    dept: string;
    des: string;
    type?: EmploymentType;
    join?: string;
    status?: EmploymentStatus;
    spec?: string;
  }): Employee {
    const gender = p.gender ?? (rng.chance(0.5) ? 'Female' : 'Male');
    const first = p.first ?? rng.pick(gender === 'Female' ? FEMALE : MALE);
    const last = p.last ?? rng.pick(LAST);
    const desig = designations.find((d) => d.id === p.des)!;
    const [lo, hi] = SALARY[p.des]!;
    const join = p.join ?? randomJoin(desig.grade <= 2 ? 2008 : 2012);
    const recent = join > addDays(t, -180);
    const status = p.status ?? (recent ? 'Probation' : 'Active');
    const dept = deptByCode(p.dept);
    const deptSeed = DEPARTMENTS.find((d) => d.code === p.dept)!;
    const emp: Employee = {
      id: `NIT-${seq++}`,
      firstName: first,
      lastName: last,
      email: makeEmail(first, last),
      phone: `+91 ${rng.int(70000, 99999)} ${rng.int(10000, 99999)}`,
      avatarColor: rng.pick(AVATAR_COLORS),
      gender,
      dateOfBirth: randomDob(desig.grade <= 2 ? 45 : 25, desig.grade <= 2 ? 60 : 50),
      address: `${rng.int(4, 220)}, ${rng.pick(STREETS)}, ${rng.pick(CITIES)}`,
      emergencyContact: `${rng.pick(rng.chance(0.5) ? FEMALE : MALE)} ${last} · +91 ${rng.int(70000, 99999)} ${rng.int(10000, 99999)}`,
      departmentId: dept.id,
      designationId: p.des,
      employmentType: p.type ?? (p.des === 'des-visit' ? 'Visiting' : rng.chance(0.08) ? 'Contract' : 'Full-time'),
      joiningDate: join,
      exitDate: null,
      reportingManagerId: null,
      status,
      qualification: rng.pick(QUAL[desig.category]!),
      specialization: p.spec ?? (desig.category === 'faculty' && deptSeed.spec.length ? rng.pick(deptSeed.spec) : desig.title),
      basicSalary: round500(lo + rng.next() * (hi - lo)),
      bankAccount: String(rng.int(10000000, 99999999)) + String(rng.int(1000, 9999)),
      documents: [],
      createdAt: `${join}T09:00:00.000Z`,
      updatedAt: `${join}T09:00:00.000Z`,
    };
    emp.documents = docsFor(rng, join);
    employees.push(emp);
    return emp;
  }

  // Fixed demo personas first so their IDs are stable.
  const principal = addEmployee({ first: 'Meera', last: 'Raghavan', gender: 'Female', dept: 'ADM', des: 'des-principal', join: '2011-07-01', spec: 'Institutional Leadership' });
  const hrManager = addEmployee({ first: 'Ananya', last: 'Kapoor', gender: 'Female', dept: 'HRD', des: 'des-hrm', join: '2016-03-14' });
  const cseHead = addEmployee({ first: 'Vikram', last: 'Sethi', gender: 'Male', dept: 'CSE', des: 'des-prof', join: '2013-08-01', spec: 'Distributed Systems' });
  const facultyUser = addEmployee({ first: 'Priya', last: 'Nair', gender: 'Female', dept: 'CSE', des: 'des-asst', join: '2021-07-15', spec: 'Machine Learning' });

  deptByCode('ADM').headId = principal.id;
  deptByCode('HRD').headId = hrManager.id;
  deptByCode('CSE').headId = cseHead.id;

  for (const d of DEPARTMENTS) {
    const dept = deptByCode(d.code);
    if (d.kind === 'academic') {
      if (!dept.headId) dept.headId = addEmployee({ dept: d.code, des: 'des-prof', join: randomJoin(2008) }).id;
      const counts = { 'des-prof': rng.int(0, 1), 'des-assoc': rng.int(1, 3), 'des-asst': rng.int(2, 5), 'des-lect': rng.int(0, 1), 'des-visit': rng.int(0, 1), 'des-labtech': d.code === 'MGT' || d.code === 'HUM' ? 0 : rng.int(1, 2), 'des-office': 1 };
      if (d.code === 'CSE') counts['des-asst'] = 5;
      for (const [des, n] of Object.entries(counts)) for (let i = 0; i < n; i++) addEmployee({ dept: d.code, des });
    } else {
      const plan: Record<string, Record<string, number>> = {
        ADM: { 'des-registrar': 1, 'des-ao': 2, 'des-office': 2 },
        HRD: { 'des-hre': 2, 'des-office': 1 },
        FIN: { 'des-finoff': 1, 'des-accountant': 3, 'des-office': 1 },
        LIB: { 'des-librarian': 1, 'des-asstlib': 2, 'des-office': 1 },
        EXM: { 'des-examco': 1, 'des-ao': 1, 'des-office': 2 },
        ITS: { 'des-sysadmin': 2, 'des-labtech': 2 },
      };
      for (const [des, n] of Object.entries(plan[d.code]!)) {
        for (let i = 0; i < n; i++) {
          const e = addEmployee({ dept: d.code, des });
          if (!dept.headId && i === 0) dept.headId = e.id;
        }
      }
    }
  }

  // Reporting lines: heads → principal, everyone else → their department head.
  for (const e of employees) {
    if (e.id === principal.id) continue;
    const dept = departments.find((d) => d.id === e.departmentId)!;
    e.reportingManagerId = dept.headId === e.id ? principal.id : dept.headId;
  }

  // A handful of exits and deactivations to make headcount trends realistic.
  const exitPool = rng.shuffle(employees.filter((e) => e.id.localeCompare('NIT-1004') > 0 && !departments.some((d) => d.headId === e.id)));
  exitPool.slice(0, 5).forEach((e, i) => {
    e.status = 'Resigned';
    e.exitDate = addDays(t, -rng.int(15, 330) - i * 3);
    if (e.joiningDate >= e.exitDate) e.joiningDate = addDays(e.exitDate, -rng.int(400, 1500));
  });
  exitPool.slice(5, 7).forEach((e) => (e.status = 'Inactive'));
  // A few recent joiners for the joining trend.
  exitPool.slice(7, 13).forEach((e, i) => {
    e.joiningDate = addDays(t, -rng.int(10, 320) - i * 4);
    e.status = e.joiningDate > addDays(t, -180) ? 'Probation' : 'Active';
    e.createdAt = e.updatedAt = `${e.joiningDate}T09:00:00.000Z`;
    e.documents = docsFor(rng, e.joiningDate);
  });

  const employedOn = (e: Employee, d: string) => e.status !== 'Inactive' && e.joiningDate <= d && (!e.exitDate || e.exitDate >= d);

  // ---- Leave requests --------------------------------------------------------
  const leaveRequests: LeaveRequest[] = [];
  const leaveDays = new Map<string, Set<string>>(); // employeeId -> dates
  const usedByType = new Map<string, number>(); // `${emp}:${year}:${type}`
  let leaveSeq = 1;

  const tryAddLeave = (e: Employee, type: LeaveType, start: string, len: number, status: LeaveRequest['status'], reason: string, comment?: string) => {
    // Find working-day window of len days starting at/after start.
    let s = start;
    while (!isWorkingDay(s, holidays)) s = addDays(s, 1);
    let end = s;
    let count = 1;
    while (count < len) {
      end = addDays(end, 1);
      if (isWorkingDay(end, holidays)) count++;
    }
    if (s.slice(0, 4) !== end.slice(0, 4)) return null;
    const days = workingDaysBetween(s, end, holidays);
    const set = leaveDays.get(e.id) ?? new Set();
    if (days.some((d) => set.has(d))) return null;
    if (!employedOn(e, s) || !employedOn(e, end)) return null;
    const key = `${e.id}:${s.slice(0, 4)}:${type}`;
    if (status === 'approved' || status === 'pending') {
      if ((usedByType.get(key) ?? 0) + days.length > settings.leavePolicy[type]) return null;
      usedByType.set(key, (usedByType.get(key) ?? 0) + days.length);
      days.forEach((d) => set.add(d));
      leaveDays.set(e.id, set);
    }
    const appliedAt = new Date(parseISODate(addDays(s, -rng.int(3, 14))).getTime() + rng.int(9, 17) * 3600000).toISOString();
    const reviewed = status === 'approved' || status === 'rejected';
    const req: LeaveRequest = {
      id: `LR-${String(leaveSeq++).padStart(4, '0')}`,
      employeeId: e.id,
      type,
      startDate: s,
      endDate: end,
      days: days.length,
      reason,
      status,
      appliedAt: appliedAt > now ? addDays(t, -1) + 'T10:00:00.000Z' : appliedAt,
      reviewedBy: reviewed ? (e.id === hrManager.id ? DEMO_USERS.admin : DEMO_USERS.hr) : null,
      reviewedAt: reviewed ? new Date(new Date(appliedAt).getTime() + 86400000).toISOString() : null,
      reviewComment: comment ?? (reviewed ? (status === 'approved' ? 'Approved. Please arrange class coverage.' : 'Declined due to examination duty.') : null),
    };
    if (req.reviewedAt && req.reviewedAt > now) req.reviewedAt = now;
    leaveRequests.push(req);
    return req;
  };

  const REASONS: Record<LeaveType, string[]> = {
    casual: ['Family function', 'Personal work', 'Attending a wedding', 'Bank and property paperwork', 'Child’s school event'],
    sick: ['Fever and cold', 'Medical consultation', 'Recovering from viral infection', 'Dental procedure'],
    earned: ['Family vacation', 'Travel to hometown', 'Annual vacation'],
    academic: ['Presenting a paper at an international conference', 'Faculty Development Programme', 'Ph.D. viva examiner duty', 'Workshop on research methods'],
    other: ['Jury duty', 'Blood donation camp volunteer', 'Election duty'],
  };

  const historyStart = monthStart(addMonths(currentPeriod(), -4));
  for (const e of employees) {
    const n = rng.int(0, 3);
    for (let i = 0; i < n; i++) {
      const type = rng.pick(['casual', 'casual', 'sick', 'earned', 'academic'] as LeaveType[]);
      const start = addDays(historyStart, rng.int(0, Math.max(1, Math.round((parseISODate(t).getTime() - parseISODate(historyStart).getTime()) / 86400000) - 5)));
      const status = rng.chance(0.88) ? 'approved' : 'rejected';
      tryAddLeave(e, type, start, rng.int(1, type === 'earned' ? 5 : 3), status, rng.pick(REASONS[type]));
    }
  }

  const active = employees.filter((e) => e.status === 'Active' || e.status === 'Probation');
  // People on approved leave today (when today is a working day).
  const leavers = rng.shuffle(active.filter((e) => e.id !== facultyUser.id)).slice(0, 4);
  leavers.forEach((e, i) => tryAddLeave(e, i % 2 ? 'sick' : 'earned', addDays(t, -i), 3, 'approved', rng.pick(REASONS[i % 2 ? 'sick' : 'earned'])));
  // Upcoming approved and pending requests.
  rng.shuffle(active).slice(0, 6).forEach((e) => tryAddLeave(e, 'casual', addDays(t, rng.int(5, 40)), rng.int(1, 3), 'approved', rng.pick(REASONS.casual)));
  const pendingPool = rng.shuffle(active.filter((e) => e.id !== facultyUser.id && e.id !== cseHead.id));
  // Make sure the CSE head has team requests to review, including an overlap.
  const cseTeam = active.filter((e) => e.departmentId === deptByCode('CSE').id && e.id !== cseHead.id && e.id !== facultyUser.id);
  const overlapStart = addDays(t, 9);
  cseTeam.slice(0, 2).forEach((e, i) => tryAddLeave(e, i ? 'academic' : 'casual', addDays(overlapStart, i), 2, 'pending', rng.pick(REASONS[i ? 'academic' : 'casual'])));
  pendingPool.slice(0, 9).forEach((e) => {
    const type = rng.pick(['casual', 'sick', 'earned', 'academic', 'other'] as LeaveType[]);
    tryAddLeave(e, type, addDays(t, rng.int(2, 35)), rng.int(1, 4), 'pending', rng.pick(REASONS[type]));
  });
  // The demo faculty member's own history.
  tryAddLeave(facultyUser, 'academic', addDays(t, -48), 2, 'approved', 'Presenting a paper at an international conference', 'Approved — all the best for the presentation.');
  tryAddLeave(facultyUser, 'casual', addDays(t, -20), 1, 'rejected', 'Personal work', 'Declined — internal assessment invigilation scheduled that day.');
  tryAddLeave(facultyUser, 'sick', addDays(t, 14), 2, 'pending', 'Scheduled minor surgery and recovery');

  // ---- Leave balances (derived from approved requests) ----------------------
  const leaveBalances: Record<string, LeaveBalance> = {};
  for (const e of employees) {
    for (const type of Object.keys(settings.leavePolicy) as LeaveType[]) {
      const id = `${e.id}:${year}:${type}`;
      const used = leaveRequests.filter((r) => r.employeeId === e.id && r.type === type && r.status === 'approved' && r.startDate.startsWith(String(year))).reduce((a, r) => a + r.days, 0);
      leaveBalances[id] = { id, employeeId: e.id, year, type, allocated: settings.leavePolicy[type], used };
    }
  }

  // ---- Attendance ---------------------------------------------------------------
  const attendance: Record<string, AttendanceRecord> = {};
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const d of workingDaysBetween(historyStart, t, holidays)) {
    const isToday = d === t;
    for (const e of employees) {
      if (!employedOn(e, d)) continue;
      const onLeave = leaveDays.get(e.id)?.has(d);
      if (isToday && !onLeave && rng.chance(0.14)) continue; // today's register is still in progress
      const id = `${e.id}:${d}`;
      let status: AttendanceRecord['status'];
      let checkIn: string | null = null;
      if (onLeave) status = 'on_leave';
      else {
        const r = rng.next();
        status = r < 0.03 ? 'absent' : r < 0.1 ? 'late' : 'present';
        if (status === 'present') checkIn = `08:${pad(rng.int(25, 59))}`;
        if (status === 'late') checkIn = `09:${pad(rng.int(16, 59))}`;
        if (status === 'present' && rng.chance(0.4)) checkIn = `09:${pad(rng.int(0, 14))}`;
      }
      attendance[id] = { id, employeeId: e.id, date: d, status, checkIn, source: onLeave ? 'leave' : 'seed', markedBy: DEMO_USERS.hr, updatedAt: `${d}T10:30:00.000Z` };
    }
  }
  // Pre-fill approved future leave into the register too.
  for (const r of leaveRequests.filter((x) => x.status === 'approved' && x.endDate > t)) {
    for (const d of workingDaysBetween(r.startDate > t ? r.startDate : addDays(t, 1), r.endDate, holidays)) {
      const id = `${r.employeeId}:${d}`;
      attendance[id] = { id, employeeId: r.employeeId, date: d, status: 'on_leave', checkIn: null, source: 'leave', markedBy: DEMO_USERS.hr, updatedAt: now };
    }
  }

  // ---- Payroll -------------------------------------------------------------------
  const payroll: Record<string, PayrollRecord> = {};
  const cur = currentPeriod();
  for (let m = -6; m <= 0; m++) {
    const period = addMonths(cur, m);
    const ps = monthStart(period);
    const pe = monthEnd(period);
    for (const e of employees) {
      if (e.status === 'Inactive' && m > -2) continue;
      if (e.joiningDate > pe || (e.exitDate && e.exitDate < ps)) continue;
      const comp = computePayroll(e.basicSalary, designations.find((d) => d.id === e.designationId)!.category);
      const id = `${e.id}:${period}`;
      const paid = m < 0;
      let lastWorking = pe;
      while (!isWorkingDay(lastWorking, holidays)) lastWorking = addDays(lastWorking, -1);
      payroll[id] = {
        id,
        employeeId: e.id,
        period,
        ...comp,
        status: paid ? 'Paid' : rng.chance(0.35) ? 'Processed' : 'Pending',
        paidOn: paid ? lastWorking : null,
        updatedAt: `${paid ? lastWorking : t}T12:00:00.000Z`,
      };
    }
  }
  // One record on hold for realism.
  const hold = Object.values(payroll).find((p) => p.period === cur && p.status === 'Pending');
  if (hold) hold.status = 'On Hold';

  // ---- Performance ----------------------------------------------------------
  const reviews: PerformanceReview[] = [];
  const facultyGoals = ['Deliver assigned courses with complete lesson plans', 'Publish two papers in Scopus-indexed journals', 'Guide final-year student projects', 'Complete a Faculty Development Programme', 'Submit a funded research proposal', 'Improve course feedback participation'];
  const adminGoals = ['Reduce request turnaround time', 'Digitise legacy records', 'Complete process compliance training', 'Support NAAC documentation', 'Improve help-desk resolution rate'];
  const training = ['Outcome-Based Education workshop', 'Research grant writing', 'Advanced Excel & reporting', 'ERP system training', 'Leadership essentials', 'Student counselling skills', 'Python for data analysis', 'Communication for administrators'];
  let revSeq = 1;
  const reviewable = employees.filter((e) => e.status !== 'Inactive' && e.status !== 'Resigned' && e.reportingManagerId);
  for (const e of reviewable) {
    const cat = designations.find((d) => d.id === e.designationId)!.category;
    const pool = cat === 'faculty' ? facultyGoals : adminGoals;
    const mk = (cycle: string, status: ReviewStatus, done: boolean): PerformanceReview => {
      const goals = rng.shuffle(pool).slice(0, 3).map((g, i) => ({ id: `g${i}`, title: g, weight: [40, 35, 25][i]!, progress: done ? rng.int(60, 100) : status === 'Not Started' ? 0 : rng.int(20, 80) }));
      const rate = () => Math.round((rng.int(28, 50) / 10) * 2) / 2;
      const rated = status === 'Completed' || status === 'Manager Review';
      const ratings = rated
        ? { teaching: cat === 'faculty' ? rate() : null, research: cat === 'faculty' ? rate() : null, service: rate(), professionalism: rate() }
        : { teaching: null, research: null, service: null, professionalism: null };
      const vals = Object.values(ratings).filter((v): v is number => v !== null);
      return {
        id: `PR-${String(revSeq++).padStart(4, '0')}`,
        employeeId: e.id,
        cycle,
        reviewerId: e.reportingManagerId,
        status,
        goals,
        ratings,
        overallRating: status === 'Completed' && vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
        managerFeedback: status === 'Completed' ? rng.pick(['Consistently prepared and well organised. Continue mentoring junior colleagues.', 'Good progress on goals. Would benefit from more research collaboration.', 'Reliable and proactive; strong contribution to departmental activities.', 'Met most objectives. Focus on timely documentation next cycle.']) : '',
        selfAssessment: status !== 'Not Started' ? 'I focused on my key objectives this cycle and have documented outcomes in the attached evidence.' : '',
        trainingNeeds: rng.shuffle(training).slice(0, rng.int(0, 2)),
        updatedAt: now,
        completedAt: status === 'Completed' ? `${year}-0${rng.int(4, 6)}-${pad(rng.int(1, 28))}T10:00:00.000Z` : null,
      };
    };
    if (e.joiningDate < `${year}-01-01`) reviews.push(mk(`Annual Review ${year - 1}–${String(year).slice(2)}`, rng.chance(0.9) ? 'Completed' : 'Manager Review', true));
    const midStatus = rng.pick(['Not Started', 'Self Assessment', 'Self Assessment', 'Manager Review', 'Completed'] as ReviewStatus[]);
    reviews.push(mk(`Mid-Year Review ${year}`, e.id === facultyUser.id ? 'Self Assessment' : midStatus, midStatus === 'Completed'));
  }

  // ---- Recruitment ------------------------------------------------------------
  const jobs: JobOpening[] = [
    { id: 'JOB-101', title: 'Assistant Professor — Artificial Intelligence', departmentId: deptByCode('CSE').id, designationId: 'des-asst', employmentType: 'Full-time', positions: 2, status: 'Open', postedOn: addDays(t, -34), closingDate: addDays(t, 21), description: 'Ph.D. in CSE/AI with strong publication record. Teach UG/PG courses in ML and supervise projects.' },
    { id: 'JOB-102', title: 'Associate Professor — VLSI Design', departmentId: deptByCode('ECE').id, designationId: 'des-assoc', employmentType: 'Full-time', positions: 1, status: 'Open', postedOn: addDays(t, -25), closingDate: addDays(t, 30), description: 'Ph.D. with 8+ years of teaching/research experience in VLSI and embedded systems.' },
    { id: 'JOB-103', title: 'Lab Technician — Robotics Lab', departmentId: deptByCode('ME').id, designationId: 'des-labtech', employmentType: 'Contract', positions: 1, status: 'Open', postedOn: addDays(t, -12), closingDate: addDays(t, 18), description: 'Diploma/B.Tech in Mechatronics. Maintain robotics lab equipment and assist practical sessions.' },
    { id: 'JOB-104', title: 'Accountant', departmentId: deptByCode('FIN').id, designationId: 'des-accountant', employmentType: 'Full-time', positions: 1, status: 'On Hold', postedOn: addDays(t, -60), closingDate: addDays(t, 10), description: 'M.Com/CA Inter with experience in institutional accounting and Tally ERP.' },
    { id: 'JOB-105', title: 'Assistant Librarian', departmentId: deptByCode('LIB').id, designationId: 'des-asstlib', employmentType: 'Full-time', positions: 1, status: 'Closed', postedOn: addDays(t, -120), closingDate: addDays(t, -70), description: 'M.Lib.Sc with experience in KOHA library management system.' },
  ];

  const onboardingTemplate = (): OnboardingItem[] => [
    { key: 'offer', label: 'Offer letter signed', done: false },
    { key: 'docs', label: 'Documents verified', done: false },
    { key: 'medical', label: 'Medical fitness certificate', done: false },
    { key: 'it', label: 'Email & ERP account created', done: false },
    { key: 'id', label: 'ID card issued', done: false },
    { key: 'induction', label: 'Induction session attended', done: false },
  ];
  const candDocs = () => [
    { name: 'Resume / CV', submitted: true },
    { name: 'Degree certificates', submitted: rng.chance(0.7) },
    { name: 'Experience letters', submitted: rng.chance(0.6) },
    { name: 'Identity proof', submitted: rng.chance(0.8) },
  ];
  const stagePlan: [string, CandidateStage][] = [
    ['JOB-101', 'Applied'], ['JOB-101', 'Applied'], ['JOB-101', 'Shortlisted'], ['JOB-101', 'Interview'], ['JOB-101', 'Interview'], ['JOB-101', 'Selected'], ['JOB-101', 'Offered'], ['JOB-101', 'Rejected'],
    ['JOB-102', 'Applied'], ['JOB-102', 'Shortlisted'], ['JOB-102', 'Interview'], ['JOB-102', 'Rejected'],
    ['JOB-103', 'Applied'], ['JOB-103', 'Applied'], ['JOB-103', 'Shortlisted'], ['JOB-103', 'Offered'],
    ['JOB-104', 'Applied'], ['JOB-104', 'Shortlisted'],
    ['JOB-105', 'Joined'], ['JOB-105', 'Rejected'], ['JOB-105', 'Rejected'],
  ];
  const candidates: Candidate[] = stagePlan.map(([jobId, stage], i) => {
    const g = rng.chance(0.5);
    const first = rng.pick(g ? FEMALE : MALE);
    const last = rng.pick(LAST);
    const job = jobs.find((j) => j.id === jobId)!;
    const onboarding = onboardingTemplate();
    if (stage === 'Offered') onboarding[0]!.done = rng.chance(0.5);
    if (stage === 'Joined') onboarding.forEach((o) => (o.done = true));
    const interviewDay = addDays(t, rng.int(1, 8));
    const academic = ['des-prof', 'des-assoc', 'des-asst'].includes(job.designationId);
    return {
      id: `CAN-${String(201 + i)}`,
      name: `${academic && rng.chance(0.6) ? 'Dr. ' : ''}${first} ${last}`,
      email: `${first}.${last}${i}@mail.example`.toLowerCase(),
      phone: `+91 ${rng.int(70000, 99999)} ${rng.int(10000, 99999)}`,
      jobId,
      stage,
      appliedOn: addDays(job.postedOn, rng.int(1, 15)),
      experienceYears: rng.int(1, 14),
      qualification: academic ? 'Ph.D.' : rng.pick(['B.Tech', 'Diploma', 'M.Com', 'M.Lib.Sc', 'MBA']),
      interviewAt: stage === 'Interview' ? `${interviewDay}T${pad(rng.int(10, 15))}:00:00` : null,
      interviewPanel: stage === 'Interview' ? 'HoD, Dean Academics, External Expert' : '',
      offerStatus: stage === 'Offered' ? 'Extended' : stage === 'Joined' ? 'Accepted' : 'None',
      notes: stage === 'Rejected' ? 'Profile did not match the required specialisation.' : '',
      onboarding,
      documentsSubmitted: candDocs(),
      employeeId: null,
    };
  });

  // ---- Users, notifications, audit, announcements ------------------------------
  const users: User[] = [
    { id: DEMO_USERS.admin, name: `Dr. ${principal.firstName} ${principal.lastName}`, email: principal.email, role: 'super_admin', employeeId: principal.id, active: true },
    { id: DEMO_USERS.hr, name: `${hrManager.firstName} ${hrManager.lastName}`, email: hrManager.email, role: 'hr', employeeId: hrManager.id, active: true },
    { id: DEMO_USERS.head, name: `Dr. ${cseHead.firstName} ${cseHead.lastName}`, email: cseHead.email, role: 'employee', employeeId: cseHead.id, active: true },
    { id: DEMO_USERS.faculty, name: `${facultyUser.firstName} ${facultyUser.lastName}`, email: facultyUser.email, role: 'employee', employeeId: facultyUser.id, active: true },
  ];

  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const notifications: Notification[] = [];
  let nSeq = 1;
  const notify = (userId: string, n: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'> & { hoursAgo: number; read?: boolean }) =>
    notifications.push({ id: `N-${nSeq++}`, userId, title: n.title, message: n.message, kind: n.kind, link: n.link, read: n.read ?? false, createdAt: ago(n.hoursAgo) });

  const pending = leaveRequests.filter((r) => r.status === 'pending');
  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id)!;
    return `${e.firstName} ${e.lastName}`;
  };
  pending.slice(0, 4).forEach((r, i) => {
    for (const u of [DEMO_USERS.hr, DEMO_USERS.admin]) notify(u, { title: 'New leave request', message: `${empName(r.employeeId)} requested ${r.days} day(s) of leave.`, kind: 'leave', link: `/leave-management?request=${r.id}`, hoursAgo: 2 + i * 5, read: i > 1 });
  });
  pending.filter((r) => cseTeam.some((e) => e.id === r.employeeId)).forEach((r, i) => notify(DEMO_USERS.head, { title: 'Team leave request', message: `${empName(r.employeeId)} requested leave from ${r.startDate}.`, kind: 'leave', link: `/leave-management?request=${r.id}`, hoursAgo: 3 + i * 4 }));
  const facApproved = leaveRequests.find((r) => r.employeeId === facultyUser.id && r.status === 'approved');
  const facRejected = leaveRequests.find((r) => r.employeeId === facultyUser.id && r.status === 'rejected');
  if (facApproved) notify(DEMO_USERS.faculty, { title: 'Leave approved', message: 'Your Academic Leave request was approved.', kind: 'leave', link: `/leave-management?request=${facApproved.id}`, hoursAgo: 24 * 40, read: true });
  if (facRejected) notify(DEMO_USERS.faculty, { title: 'Leave rejected', message: 'Your Casual Leave request was not approved. See reviewer comments.', kind: 'leave', link: `/leave-management?request=${facRejected.id}`, hoursAgo: 24 * 18 });
  notify(DEMO_USERS.faculty, { title: 'Payslip available', message: `Your payslip for ${addMonths(cur, -1)} is ready to download.`, kind: 'payroll', link: '/payroll', hoursAgo: 24 * 10 });
  notify(DEMO_USERS.faculty, { title: 'Mid-year review open', message: 'Please complete your self-assessment for the mid-year review.', kind: 'performance', link: '/performance', hoursAgo: 30 });
  notify(DEMO_USERS.head, { title: 'Reviews awaiting you', message: 'Mid-year reviews for your department are awaiting manager input.', kind: 'performance', link: '/performance', hoursAgo: 28 });
  notify(DEMO_USERS.hr, { title: 'Interviews this week', message: `${candidates.filter((c) => c.stage === 'Interview').length} candidate interviews are scheduled.`, kind: 'recruitment', link: '/recruitment', hoursAgo: 6 });
  notify(DEMO_USERS.hr, { title: 'Payroll pending', message: `Payroll for ${cur} is awaiting processing.`, kind: 'payroll', link: '/payroll', hoursAgo: 20 });
  notify(DEMO_USERS.admin, { title: 'Weekly HR digest', message: 'Headcount, attendance and leave summary for the past week is ready.', kind: 'system', link: '/reports', hoursAgo: 50, read: true });

  // Work anniversaries in the next 14 days.
  const anniversaries = employees
    .filter((e) => (e.status === 'Active' || e.status === 'Probation') && e.joiningDate.slice(0, 4) !== String(year))
    .filter((e) => {
      const md = e.joiningDate.slice(5);
      for (let i = 0; i <= 14; i++) if (addDays(t, i).slice(5) === md) return true;
      return false;
    });
  anniversaries.slice(0, 3).forEach((e, i) => {
    for (const u of [DEMO_USERS.hr, DEMO_USERS.admin]) notify(u, { title: 'Upcoming work anniversary', message: `${e.firstName} ${e.lastName} completes ${year - Number(e.joiningDate.slice(0, 4))} years soon.`, kind: 'anniversary', link: `/employees/${e.id}`, hoursAgo: 12 + i });
  });

  const auditLogs: AuditLog[] = [];
  let aSeq = 1;
  const audit = (hoursAgo: number, actor: User, action: string, entity: string, entityId: string, summary: string) =>
    auditLogs.push({ id: `A-${aSeq++}`, at: ago(hoursAgo), actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, entity, entityId, summary });
  const [uAdmin, uHr] = users;
  audit(72, uAdmin!, 'system.seed', 'system', 'demo', 'Demo workspace initialised with sample data');
  const recentJoiner = [...employees].sort((a, b) => b.joiningDate.localeCompare(a.joiningDate))[0]!;
  audit(60, uHr!, 'employee.create', 'employee', recentJoiner.id, `Onboarded ${recentJoiner.firstName} ${recentJoiner.lastName}`);
  leaveRequests.filter((r) => r.reviewedAt && r.reviewedAt > ago(24 * 7)).slice(0, 6).forEach((r, i) => audit(30 - i * 3, r.reviewedBy === uAdmin!.id ? uAdmin! : uHr!, `leave.${r.status === 'approved' ? 'approve' : 'reject'}`, 'leave_request', r.id, `${r.status === 'approved' ? 'Approved' : 'Rejected'} leave ${r.id} for ${empName(r.employeeId)}`));
  audit(26, uHr!, 'payroll.mark_paid', 'payroll', addMonths(cur, -1), `Marked payroll for ${addMonths(cur, -1)} as paid`);
  audit(8, uHr!, 'attendance.mark', 'attendance', t, `Recorded attendance register for ${t}`);
  auditLogs.sort((a, b) => b.at.localeCompare(a.at));

  const announcements: Announcement[] = [
    { id: 'AN-1', title: 'NAAC peer team visit', body: 'The NAAC peer team visits campus for re-accreditation. Departments should keep criterion files ready.', category: 'Academic', date: addDays(t, 16), createdBy: DEMO_USERS.admin, createdAt: ago(48) },
    { id: 'AN-2', title: 'Faculty Development Programme on Generative AI', body: 'A 5-day FDP organised by CSE. Registration open for all faculty.', category: 'Event', date: addDays(t, 6), createdBy: DEMO_USERS.hr, createdAt: ago(30) },
    { id: 'AN-3', title: 'Mid-semester examinations', body: 'Mid-semester examinations commence. Invigilation duties are published by the Examination Cell.', category: 'Academic', date: addDays(t, 11), createdBy: DEMO_USERS.admin, createdAt: ago(20) },
    { id: 'AN-4', title: 'Annual Sports Meet', body: 'Staff are invited to participate in the staff relay and tug-of-war events.', category: 'Event', date: addDays(t, 24), createdBy: DEMO_USERS.hr, createdAt: ago(10) },
  ];
  // Surface the next upcoming holiday as an announcement too.
  const nextHoliday = holidays.find((h) => h.date >= t);
  if (nextHoliday) announcements.push({ id: 'AN-5', title: `${nextHoliday.name} holiday`, body: `The college remains closed on account of ${nextHoliday.name}.`, category: 'Holiday', date: nextHoliday.date, createdBy: DEMO_USERS.admin, createdAt: ago(5) });

  return {
    version: DB_VERSION,
    seededAt: now,
    users,
    departments,
    designations,
    employees,
    attendance,
    leaveRequests,
    leaveBalances,
    payroll,
    reviews,
    jobs,
    candidates,
    notifications,
    auditLogs,
    announcements,
    settings,
  };
}
