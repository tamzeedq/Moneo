import { expect, type Page } from '@playwright/test';

/** Opens a page in the demo workspace (sample data, "today" pinned to Oct 4, 2025). */
export async function openDemo(page: Page, path = '/') {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}workspace=demo`);
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible();
}

/** The toast region (bottom right). */
export const toasts = (page: Page) => page.getByRole('status');
