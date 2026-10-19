import { expect, test } from '@playwright/test';
import { signIn } from './support/session';

test.describe('single sign-on', () => {
  test('signs in through Keycloak and returns to the requested page', async ({
    page,
  }) => {
    await signIn(page, 'alice', '/demo');
    await expect(page).toHaveURL('/demo');
    await expect(page.getByTestId('user-name')).toHaveText('Alice Demo');

    const me = await page.request.get('/auth/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({
      name: 'Alice Demo',
      roles: ['shell-user', 'demo-access'],
    });
  });

  test('logs out of both the BFF and Keycloak', async ({ page }) => {
    await signIn(page, 'alice');
    await page
      .locator('mf-app-header')
      .getByRole('button', { name: 'Log out' })
      .click();

    // The Keycloak session is gone too, so the shell sends us back to the login form.
    await expect(page.locator('#kc-login')).toBeVisible();
    expect((await page.request.get('/auth/me')).status()).toBe(401);
  });
});
