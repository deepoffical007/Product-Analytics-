import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Persona = 'u-admin' | 'u-hr' | 'u-head' | 'u-faculty';

async function login(page: Page, persona: Persona) {
  await page.goto('/login');
  await page.getByTestId(`login-${persona}`).click();
  await page.waitForURL('**/dashboard');
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOLIDAY_MD = ['01-26', '03-04', '04-03', '05-01', '08-15', '10-02', '10-20', '11-09', '12-25'];

/** A working day at least `offset` days ahead that stays inside the same calendar year when possible. */
function futureWorkday(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6 || HOLIDAY_MD.includes(iso(d).slice(5))) d.setDate(d.getDate() + 1);
  return iso(d);
}

test.describe('College Employee Management System — core journeys', () => {
  test('Super Admin creates an employee with validation, and it persists after refresh', async ({ page }) => {
    await login(page, 'u-admin');
    await page.goto('/employees');
    await page.getByRole('button', { name: 'Add employee' }).click();
    const form = page.getByRole('dialog');
    await expect(form.getByRole('heading', { name: 'Add new employee' })).toBeVisible();

    // Inline validation on an empty submit.
    await form.getByRole('button', { name: 'Create employee' }).click();
    await expect(form.getByText('First name is required')).toBeVisible();
    await expect(form.getByText('Enter a valid email address')).toBeVisible();

    await form.getByLabel('First name').fill('Kavita');
    await form.getByLabel('Last name').fill('Rangan');
    await form.getByLabel('Date of birth').fill('1991-05-20');
    await form.getByLabel('Work email').fill('kavita.rangan@northfield.edu.in');
    await form.getByLabel('Phone').fill('+91 98200 11223');
    await form.getByLabel('Department').selectOption({ label: 'Mathematics' });
    await form.getByLabel('Designation').selectOption({ label: 'Assistant Professor' });
    await form.getByLabel('Highest qualification').fill('Ph.D.');
    await form.getByLabel('Bank account number').fill('501234567890');
    await form.getByRole('button', { name: 'Create employee' }).click();

    await expect(page.getByText('Kavita Rangan added to the directory')).toBeVisible();
    await page.waitForURL(/\/employees\/NIT-\d+$/);
    await expect(page.getByRole('heading', { name: 'Kavita Rangan' })).toBeVisible();
    const url = page.url();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Kavita Rangan' })).toBeVisible();
    expect(page.url()).toBe(url);

    // Duplicate email is rejected.
    await page.goto('/employees?new=1');
    const dup = page.getByRole('dialog');
    await dup.getByLabel('First name').fill('Copy');
    await dup.getByLabel('Last name').fill('Cat');
    await dup.getByLabel('Date of birth').fill('1990-01-01');
    await dup.getByLabel('Work email').fill('kavita.rangan@northfield.edu.in');
    await dup.getByLabel('Phone').fill('+91 98200 11224');
    await dup.getByLabel('Department').selectOption({ label: 'Mathematics' });
    await dup.getByLabel('Designation').selectOption({ label: 'Lecturer' });
    await dup.getByLabel('Highest qualification').fill('M.Sc');
    await dup.getByLabel('Bank account number').fill('501234567891');
    await dup.getByRole('button', { name: 'Create employee' }).click();
    await expect(dup.getByRole('alert').filter({ hasText: 'already used by another employee' })).toBeVisible();
  });

  test('HR moves an employee to another department; the change persists and is audited', async ({ page }) => {
    await login(page, 'u-hr');
    await page.goto('/employees/NIT-1005');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Department').selectOption({ label: 'Electronics & Communication' });
    await form.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Employee record updated')).toBeVisible();

    await page.reload();
    await expect(page.getByText(/· Electronics & Communication ·/)).toBeVisible();

    await page.goto('/notifications?tab=activity');
    await expect(page.getByRole('cell', { name: /to Electronics & Communication/ }).first()).toBeVisible();
  });

  test('Employee applies for leave, department head approves, balance and notifications update', async ({ page }) => {
    const day = futureWorkday(24);
    await login(page, 'u-faculty');
    await page.goto('/leave-management');
    const casualCard = page.locator('div', { has: page.getByText('Casual Leave', { exact: true }) }).filter({ hasText: 'used' }).last();
    const before = await casualCard.locator('p.text-2xl').innerText();

    await page.getByRole('button', { name: 'Apply for leave' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Leave type').selectOption('casual');
    await dlg.getByLabel('Start date').fill(day);
    await dlg.getByLabel('End date').fill(day);
    await dlg.getByLabel('Reason').fill('Attending a family wedding');
    await expect(dlg.getByText('Working days requested')).toBeVisible();
    await dlg.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText(/submitted for approval/)).toBeVisible();
    const myRow = page.getByRole('row').filter({ hasText: 'Casual Leave' }).filter({ hasText: 'Pending' });
    await expect(myRow.first()).toBeVisible();
    await logout(page);

    await login(page, 'u-head');
    await page.goto('/leave-management?tab=approvals');
    const row = page.getByRole('row').filter({ hasText: 'Priya Nair' }).filter({ hasText: 'Casual Leave' });
    await row.getByRole('button', { name: 'Review' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Attending a family wedding')).toBeVisible();
    await sheet.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/Request approved/)).toBeVisible();
    await logout(page);

    await login(page, 'u-faculty');
    await page.goto('/notifications');
    await expect(page.getByText('Leave approved').first()).toBeVisible();
    await page.goto('/leave-management');
    const after = await page.locator('div', { has: page.getByText('Casual Leave', { exact: true }) }).filter({ hasText: 'used' }).last().locator('p.text-2xl').innerText();
    // Pending reserved the day already; approval must not deduct it a second time.
    expect(parseInt(after, 10)).toBe(parseInt(before, 10) - 1);
  });

  test('Manager rejection requires a comment', async ({ page }) => {
    await login(page, 'u-hr');
    await page.goto('/leave-management?tab=approvals');
    await page.getByRole('button', { name: 'Review' }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Reject' }).click();
    await expect(sheet.getByText('A comment is required when rejecting a request.')).toBeVisible();
    await sheet.getByLabel('Reviewer comment').fill('Examination duty scheduled on these dates.');
    await sheet.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText(/Request rejected/)).toBeVisible();
  });

  test('Marking attendance updates the dashboard “Present today” metric', async ({ page }) => {
    const now = new Date();
    test.skip(now.getDay() === 0 || now.getDay() === 6 || HOLIDAY_MD.includes(iso(now).slice(5)), 'Attendance is only recorded on working days');
    await login(page, 'u-hr');
    const before = Number(await page.getByTestId('stat-present-today').innerText());

    await page.goto('/attendance');
    await page.getByRole('button', { name: /Not marked/ }).click(); // filter to unmarked staff
    const row = page.getByRole('row').filter({ has: page.getByRole('radiogroup') }).first();
    await row.getByRole('radio', { name: 'Present' }).click();
    await expect(page.getByText(/Attendance saved/)).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByTestId('stat-present-today')).toHaveText(String(before + 1));
    await page.reload();
    await expect(page.getByTestId('stat-present-today')).toHaveText(String(before + 1));
  });

  test('HR exports employee records to CSV', async ({ page }) => {
    await login(page, 'u-hr');
    await page.goto('/employees');
    const shown = Number((await page.getByText(/^Showing/).innerText()).match(/of (\d+)/)![1]);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^employees-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await download.path())!, 'utf8').replace(/^﻿/, '');
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain('Employee ID,First Name,Last Name,Email');
    expect(lines).toHaveLength(shown + 1);
  });

  test('Employees cannot access restricted payroll and directory data', async ({ page }) => {
    await login(page, 'u-faculty');
    await page.goto('/payroll');
    await expect(page.getByRole('heading', { name: 'My payslips' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run payroll' })).toHaveCount(0);
    await expect(page.getByText('Ananya Kapoor')).toHaveCount(0);

    for (const path of ['/employees', '/employees/NIT-1002', '/reports', '/recruitment', '/departments']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
    }
    // Restricted pages are not offered in navigation either.
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Employees' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Reports' })).toHaveCount(0);
  });

  test('Department with active employees cannot be deactivated', async ({ page }) => {
    await login(page, 'u-admin');
    await page.goto('/departments');
    await page.getByRole('button', { name: 'Actions for Computer Science & Engineering' }).click();
    await page.getByRole('menuitem', { name: /Deactivate/ }).click();
    await expect(page.getByText(/still has \d+ active employee/)).toBeVisible();
  });

  test('Theme toggle, global search and reset demo data', async ({ page }) => {
    await login(page, 'u-admin');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/Search by name/).fill('Priya Nair');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/employees/NIT-1004');

    await page.goto('/settings?section=data');
    await page.getByRole('button', { name: 'Reset demo data' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset data' }).click();
    await page.waitForURL('**/login');
  });
});
