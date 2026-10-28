import { expect, test } from '@playwright/test';
import { openDemo, toasts } from './helpers';

test('adds a paycheque through all four steps', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('link', { name: '+ Add paycheque' }).click();

  // 1. Details: prefilled from the Sep 26 paycheque
  await expect(page.getByRole('heading', { name: 'Add paycheque' })).toBeVisible();
  await expect(page.getByText('Same as last 5 of 6')).toBeVisible();
  await expect(page.locator('#payDate')).toHaveValue('2025-10-10');
  await page.getByRole('button', { name: 'Continue →' }).click();

  // 2. Split: steppers, over-allocation blocks Continue, reset restores the template
  await expect(page.getByRole('heading', { name: 'Split to accounts' })).toBeVisible();
  await expect(page.getByText('Every dollar has a job')).toBeVisible();
  await page.getByRole('button', { name: 'Increase TFSA amount' }).click();
  await expect(page.getByText('$20.00 over the paycheque')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('Every dollar has a job')).toBeVisible();
  await page.getByRole('button', { name: 'Continue →' }).click();

  // 3. Budget: the copied plan is over the pool, which warns but is allowed
  await expect(page.getByRole('heading', { name: 'Budget this paycheque' })).toBeVisible();
  await expect(page.getByText('$350.00 over the pool')).toBeVisible();
  // The draft survives a reload.
  await page.reload();
  await expect(page.getByText('$350.00 over the pool')).toBeVisible();
  await page.getByRole('button', { name: 'Review →' }).click();

  // 4. Review and save
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await page.getByRole('button', { name: 'Save paycheque' }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(toasts(page)).toContainText('Paycheque saved · Fri, Oct 10 · $2,640.00');
  await expect(page.getByText('Planned ✓')).toBeVisible();

  // The next draft continues from the saved paycheque.
  await page.getByRole('link', { name: '+ Add paycheque' }).click();
  await expect(page.locator('#payDate')).toHaveValue('2025-10-24');
});

test('finishing the Sep 26 allocation updates the Overview', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('link', { name: 'Finish allocating' }).click();
  await expect(page.getByText('12% of this paycheque is unassigned')).toBeVisible();
  // RRSP gets the missing $320 (16 × $20).
  const increase = page.getByRole('button', { name: 'Increase RRSP amount' });
  for (let i = 0; i < 16; i++) await increase.click();
  await page.getByRole('button', { name: 'Save allocation' }).click();
  await expect(toasts(page)).toContainText('Allocation saved');

  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByText('Every dollar has a job')).toBeVisible();
  await expect(page.getByText('36%')).toBeVisible();
});
