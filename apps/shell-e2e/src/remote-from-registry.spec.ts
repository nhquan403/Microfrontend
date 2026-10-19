import { expect, test } from '@playwright/test';
import { signIn } from './support/session';

test('the demo remote is loaded from the URL the registry returns', async ({
  page,
}) => {
  const registryResponse = page.waitForResponse((r) =>
    r.url().endsWith('/registry'),
  );
  const remoteEntryRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('remoteEntry.json'))
      remoteEntryRequests.push(new URL(r.url()).pathname);
  });

  await signIn(page, 'alice', '/demo');
  const registry = await (await registryResponse).json();
  await expect(page.getByTestId('demo-title')).toBeVisible();

  expect(registry.manifest.demo).toBe('/apps/demo/remoteEntry.json');
  expect(remoteEntryRequests).toContain(registry.manifest.demo);
});
