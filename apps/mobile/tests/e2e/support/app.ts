import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The app mounts inside `#root`. Expo's dev-only fast-refresh overlay is injected as a
 * later sibling under the same root, so scoping to the first child keeps a11y assertions
 * free of dev-tooling noise (and still resolves in a production static export).
 */
export function appRoot(page: Page): Locator {
  return page.locator('#root > div').first();
}

/** RN Web renders `testID` as `data-testid`, so the default Playwright testId attribute works. */
export function welcomeCta(page: Page, kind: 'start' | 'login'): Locator {
  return page.getByTestId(`welcome-cta-${kind}`);
}

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
}

/**
 * Asserts the current pathname exactly. `toHaveURL('/')` also matches `/welcome` in some
 * Playwright versions, so we compare the parsed pathname instead.
 */
export async function expectPathname(page: Page, pathname: string): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).pathname, { message: `expected pathname ${pathname}` })
    .toBe(pathname);
}

export function isSmallPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 390) < 340;
}

/** Cold start lands on /welcome because the session flag is in-memory only. */
export async function expectWelcomeScreen(page: Page): Promise<void> {
  await expectPathname(page, '/welcome');
  await expect(page.getByRole('heading', { name: 'Meet someone who gives a damn.' })).toBeVisible();
}
