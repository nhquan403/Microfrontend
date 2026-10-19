import { expect, test } from '@playwright/test';
import { sidebarTitles, signIn } from './support/session';

test('alice, who has demo-access, sees and opens the demo remote', async ({
  page,
}) => {
  await signIn(page, 'alice');
  expect(await sidebarTitles(page)).toEqual(['Home', 'Demo']);
  await page.goto('/demo');
  await expect(page.getByTestId('demo-title')).toBeVisible();
});

test('bob, without demo-access, is blocked in the shell and at the BFF', async ({
  page,
}) => {
  await signIn(page, 'bob');
  expect(await sidebarTitles(page)).toEqual(['Home']);

  await page.goto('/demo');
  await expect(page).toHaveURL('/forbidden');
  await expect(page.getByTestId('forbidden')).toBeVisible();

  expect((await page.request.get('/apps/demo/remoteEntry.json')).status()).toBe(
    403,
  );
  expect((await page.request.get('/api/hello')).status()).toBe(403);
  const registry = await (await page.request.get('/registry')).json();
  expect(registry.manifest).toEqual({});
});
