import { expect, test } from '@playwright/test';
import { openDemo } from './helpers';

test('shows the 4a figures for the current paycheque', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole('heading', { name: /, Sam$/ })).toBeVisible();
  await expect(page.getByText('Saturday, Oct 4 · day 8 of 14 this paycheque')).toBeVisible();
  await expect(page.getByText('▲ $1,842.10 · 3.97%')).toBeVisible();
  await expect(page.getByText('$1,833.49').first()).toBeVisible();
  await expect(page.getByText('32%')).toBeVisible();
  await expect(page.getByText('on track for $2,088')).toBeVisible();
  await expect(page.getByText('$320 unallocated')).toBeVisible();
});

test('the period selector re-scopes spending and income', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('radio', { name: 'Month' }).click();
  await expect(page.getByText('day 3 of 31 in October 2025')).toBeVisible();
  await expect(page.getByText('vs. 3-month avg')).toBeVisible();
  // No paycheque has been paid in October yet.
  await expect(page.getByText('Paycheques in (0)')).toBeVisible();

  await page.getByRole('radio', { name: 'Year' }).click();
  await expect(page.getByText('day 276 of 365 in 2025')).toBeVisible();

  await page.getByRole('radio', { name: 'Custom' }).click();
  await page.getByRole('button', { name: /Sep 5 – Oct 4/ }).click();
  await page.getByLabel('From').fill('2025-09-01');
  await page.getByLabel('To').fill('2025-09-14');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Saturday, Oct 4 · Sep 1 – Sep 14')).toBeVisible();
  await expect(page.getByText('spent in Sep 1 – Sep 14')).toBeVisible();

  // The choice is remembered.
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Custom' })).toHaveAttribute('data-state', 'on');
});

test('theme toggle persists and the command palette navigates', async ({ page }) => {
  await openDemo(page);
  const theme = () => page.locator('html').getAttribute('data-theme');
  const before = await theme();
  await page.getByRole('button', { name: /mode$/ }).click();
  expect(await theme()).not.toBe(before);
  await page.reload();
  expect(await theme()).not.toBe(before);

  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search or jump to…').fill('tfsa');
  await expect(page.getByRole('option', { name: /TFSA/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/accounts\?id=tfsa/);
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
});
