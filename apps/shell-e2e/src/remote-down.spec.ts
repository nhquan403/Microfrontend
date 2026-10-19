import { expect, test } from '@playwright/test';
import { navigateInShell, sidebarTitles, signIn } from './support/session';

test('a remote that cannot load only affects the content area', async ({
  page,
}) => {
  await page.route('**/apps/demo/**', (route) => route.abort());
  await signIn(page, 'alice');

  await navigateInShell(page, '/demo');
  await expect(page.getByTestId('remote-error')).toContainText(
    'Demo is unavailable',
  );
  await expect(page).toHaveURL('/demo');
  await expect(page.getByTestId('user-name')).toHaveText('Alice Demo');
  expect(await sidebarTitles(page)).toEqual(['Home', 'Demo']);

  await navigateInShell(page, '/');
  await expect(page.locator('main')).toContainText('Welcome, Alice Demo');

  await page.unroute('**/apps/demo/**');
  await navigateInShell(page, '/demo');
  await page.getByTestId('remote-retry').click();
  await expect(page.getByTestId('demo-title')).toBeVisible();
});
