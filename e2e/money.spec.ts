import { expect, test } from '@playwright/test';
import { openDemo, toasts } from './helpers';

test('imports a bank CSV, skipping rows already in Moneo', async ({ page }) => {
  await openDemo(page, '/import');
  await page.getByRole('button', { name: 'Try a sample file' }).click();
  await expect(page.getByText('5 to import')).toBeVisible();
  await expect(page.getByText('1 already in Moneo')).toBeVisible();
  // Categories are suggested from merchant history and keywords.
  await expect(page.getByLabel('Category for Tim Hortons')).toHaveValue(/.+/);
  await page.getByRole('button', { name: 'Import 5 transactions' }).click();
  await expect(toasts(page)).toContainText('Imported 5 transactions into Spending');
  await expect(page).toHaveURL(/\/accounts\?id=spending/);
});

test('adds a transaction by hand and updates the balance', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '+ Transaction' }).click();
  await page.getByLabel('Amount').fill('12.40');
  await page.getByLabel('Merchant').fill('Tim Hortons');
  await expect(page.getByRole('combobox', { name: 'Category' })).toContainText('Dining');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await expect(toasts(page)).toContainText('Added Tim Hortons · −$12.40');
  await expect(page.getByText('$1,845.89').first()).toBeVisible(); // spent so far: $1,833.49 + $12.40
});

test('updates an account balance from the Overview quick action', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('link', { name: 'Update balance' }).click();
  await expect(page.getByRole('dialog', { name: 'Update Chequing' })).toBeVisible();
  await page.getByRole('dialog').getByRole('textbox').fill('3500');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(toasts(page)).toContainText('Chequing balance updated · $3,500.00');
  await expect(page.getByText('$48,304')).toBeVisible(); // $48,216.40 + $87.90
});

test('budget plan can be edited and saved', async ({ page }) => {
  await openDemo(page, '/budget');
  await expect(page.getByText('$32.15 over plan')).toBeVisible();
  await page.getByRole('button', { name: 'Edit plan' }).click();
  const increase = page.getByRole('button', { name: 'Increase Dining plan' });
  for (let i = 0; i < 4; i++) await increase.click();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(toasts(page)).toContainText('Plan saved');
  await expect(page.getByText('$32.15 over plan')).toHaveCount(0);
});
