import { expect, test } from '@playwright/test';
import { signIn } from './support/session';

const JWT = /eyJ[\w-]+\.[\w-]+\./;

test('no access, refresh or ID token is reachable from browser JavaScript', async ({
  page,
  context,
}) => {
  await signIn(page, 'alice', '/demo');
  await expect(page.getByTestId('api-message')).toBeVisible();

  const exposed = await page.evaluate(async () => {
    const values: string[] = [];
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i) ?? '';
        values.push(key, store.getItem(key) ?? '');
      }
    }
    values.push(document.cookie);
    const databases = (await indexedDB.databases?.()) ?? [];
    values.push(...databases.map((db) => db.name ?? ''));
    for (const key of Object.keys(window)) {
      try {
        const value = (window as unknown as Record<string, unknown>)[key];
        if (typeof value === 'string') values.push(value);
        else if (
          value &&
          typeof value === 'object' &&
          value.constructor === Object
        ) {
          values.push(JSON.stringify(value));
        }
      } catch {
        // Cross-origin or throwing getters are not readable by scripts either.
      }
    }
    return values.join('\n');
  });

  expect(exposed).not.toMatch(JWT);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    '__Host-sid',
  );

  const session = (await context.cookies()).find(
    (c) => c.name === '__Host-sid',
  );
  expect(session).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  });
});
