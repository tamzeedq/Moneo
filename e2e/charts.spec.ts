import { expect, test } from '@playwright/test';
import { openDemo, toasts } from './helpers';

test('library filters and search', async ({ page }) => {
  await openDemo(page, '/charts');
  await expect(page.getByText('6 charts · 3 pinned to Overview')).toBeVisible();
  const cards = page.locator('main a[href^="/charts/"]').filter({ has: page.locator('[class*="text-[14px]"]') });
  await expect(cards).toHaveCount(6);
  await page.getByRole('button', { name: 'Pinned 3' }).click();
  await expect(cards).toHaveCount(3);
  await page.getByRole('button', { name: 'All 6' }).click();
  await page.getByLabel('Search charts').fill('net');
  await expect(cards).toHaveCount(1);
});

test('new chart from a question, edit it, pin it, unpin it', async ({ page }) => {
  await openDemo(page, '/charts/new');
  await page.getByRole('option', { name: /Am I sticking to plan\?/ }).click();
  await expect(page.getByText('Dining vs. plan').first()).toBeVisible();
  await page.getByRole('button', { name: 'Use this chart →' }).click();

  // Editor autosaves; range and colour survive a reload.
  await expect(page.getByText(/Chart Studio \/ Edit/)).toBeVisible();
  await page.getByRole('radio', { name: '1 yr' }).click();
  await page.reload();
  await expect(page.getByRole('radio', { name: '1 yr' })).toHaveAttribute('data-state', 'on');

  await page.getByRole('link', { name: 'Pin to Overview' }).click();
  await page.getByRole('radio', { name: /Small/ }).click();
  await expect(page.getByText('Lands after Spending pace · small card')).toBeVisible();
  await page.getByRole('button', { name: 'Pin chart' }).click();
  await expect(toasts(page)).toContainText('Pinned “Dining vs. plan” after Spending pace');

  // On the Overview, then removed from the card menu.
  const card = page.getByRole('link', { name: 'Dining vs. plan' });
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Options for Dining vs. plan' }).click();
  await page.getByRole('button', { name: 'Unpin' }).click();
  await expect(card).toHaveCount(0);
});

test('editor stats follow the range and notes can be added', async ({ page }) => {
  await openDemo(page, '/charts/savings-rate');
  await expect(page.getByText('over 12 paycheques')).toBeVisible();
  await page.getByRole('radio', { name: '1 yr' }).click();
  await expect(page.getByText('over 26 paycheques')).toBeVisible();
  await page.getByRole('button', { name: '+ Add note' }).click();
  await page.getByPlaceholder('e.g. Raise · 4%').fill('New job');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('New job').first()).toBeVisible();
});
