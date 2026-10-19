import { expect, test } from '@playwright/test';
import { signIn } from './support/session';

test.describe('CSRF protection on state-changing requests', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'alice');
  });

  async function csrfToken(context: import('@playwright/test').BrowserContext) {
    return (
      (await context.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ??
      ''
    );
  }

  test('rejects a write without the CSRF header', async ({ page }) => {
    const res = await page.request.post('/api/echo', {
      headers: { Origin: 'http://localhost:4000' },
      data: { message: 'x' },
    });
    expect(res.status()).toBe(403);
  });

  test('rejects a write from another origin even with the token', async ({
    page,
    context,
  }) => {
    const res = await page.request.post('/api/echo', {
      headers: {
        Origin: 'https://evil.example',
        'X-XSRF-TOKEN': await csrfToken(context),
      },
      data: { message: 'x' },
    });
    expect(res.status()).toBe(403);
  });

  test('accepts a same-origin write with the token', async ({
    page,
    context,
  }) => {
    const res = await page.request.post('/api/echo', {
      headers: {
        Origin: 'http://localhost:4000',
        'X-XSRF-TOKEN': await csrfToken(context),
      },
      data: { message: 'x' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).echoed).toEqual({ message: 'x' });
  });
});
