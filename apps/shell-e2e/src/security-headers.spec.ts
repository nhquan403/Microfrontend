import { expect, test } from '@playwright/test';
import { signIn, trackCspViolations } from './support/session';

test('documents carry the full security header set', async ({ page }) => {
  await signIn(page, 'alice');
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};

  const csp = headers['content-security-policy'];
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("require-trusted-types-for 'script'");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
});

test('the shell and a remote run without any CSP or Trusted Types violation', async ({
  page,
}) => {
  const violations = await trackCspViolations(page);
  await signIn(page, 'alice', '/demo');
  await expect(page.getByTestId('api-message')).toBeVisible();
  await page.getByTestId('echo-submit').click();
  await expect(page.getByTestId('echo-result')).toBeVisible();
  expect(violations).toEqual([]);
});
