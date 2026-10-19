import { expect, type Page } from '@playwright/test';

export type TestUser = 'alice' | 'bob';

const PASSWORD_VARS: Record<TestUser, string> = {
  alice: 'E2E_ALICE_PASSWORD',
  bob: 'E2E_BOB_PASSWORD',
};

function passwordFor(user: TestUser): string {
  const value = process.env[PASSWORD_VARS[user]];
  if (!value)
    throw new Error(`${PASSWORD_VARS[user]} is not set (see .env.example)`);
  return value;
}

/** Opens `path` in the shell, completes the Keycloak login form and waits for the shell. */
export async function signIn(
  page: Page,
  user: TestUser,
  path = '/',
): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/localhost:8080\/realms\/microfrontend/);
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(passwordFor(user));
  await page.locator('#kc-login').click();
  await expect(page.getByTestId('user-name')).toBeVisible();
}

/** Collects CSP and Trusted Types violations raised anywhere in the page. */
export async function trackCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP-VIOLATION ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (message.text().startsWith('CSP-VIOLATION'))
      violations.push(message.text());
  });
  return violations;
}

export function sidebarTitles(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (
      (
        document.querySelector('mf-sidebar') as unknown as {
          items?: { title: string }[];
        }
      )?.items ?? []
    ).map((item) => item.title),
  );
}

/** Same as clicking a sidebar link: the shell router handles `mf-navigate`. */
export function navigateInShell(page: Page, route: string): Promise<boolean> {
  return page.evaluate(
    (r) =>
      document
        .querySelector('mf-sidebar')
        ?.dispatchEvent(
          new CustomEvent('mf-navigate', { detail: { route: r } }),
        ) ?? false,
    route,
  );
}
