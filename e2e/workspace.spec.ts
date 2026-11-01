import { expect, test } from '@playwright/test';
import { openDemo } from './helpers';

test('a fresh visit starts an empty workspace with a welcome screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Moneo' })).toBeVisible();
  await expect(page.getByText('Demo data', { exact: true })).toHaveCount(0);

  // Screens that need accounts explain why instead of breaking.
  await page.goto('/paycheques/new/details');
  await expect(page.getByText('A paycheque is split across your accounts')).toBeVisible();
});

test('setting up starter accounts unlocks the dashboard and wizard on the real clock', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Chequing balance').fill('1500');
  await page.getByRole('button', { name: /^Create \d+ accounts?$/ }).click();

  await expect(page.getByText('Net position')).toBeVisible();
  await expect(page.getByText('$1,500.00').first()).toBeVisible();
  await expect(page.getByText('Add your first paycheque')).toBeVisible();

  await page.getByRole('link', { name: '+ Add paycheque' }).click();
  await expect(page.getByRole('heading', { name: 'Add paycheque' })).toBeVisible();
  // No previous paycheque, so the pay date defaults to today on the real clock.
  const today = new Date().toLocaleDateString('en-CA');
  await expect(page.locator('#payDate')).toHaveValue(today);
});

test('the demo is separate from my data and can be left', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByText('$48,216.40')).toHaveCount(0); // hero splits the cents
  await expect(page.getByText('$48,216')).toBeVisible();
  await expect(page.getByText('Saturday, Oct 4')).toBeVisible();

  await page.getByRole('button', { name: 'Exit demo' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Moneo' })).toBeVisible();
});
