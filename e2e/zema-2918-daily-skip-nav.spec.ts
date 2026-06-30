import { test, expect } from '@playwright/test';

/**
 * ZEMA-2918: blog/daily skip-nav tabindex fix verification
 *
 * Daily fortune pages (blog/daily/*.html) use a semantic <article> (or
 * <section> on the index) as the skip-nav target (#main-content), placed
 * after the header so the skip truly bypasses navigation. These tags are
 * not natively focusable, so tabindex="-1" must be present for the skip
 * link to move keyboard / screen-reader focus (WCAG 2.1 AA).
 */

// Spot-check representative pages
const SPOT_CHECK_PAGES = [
  { label: 'daily 2026-07-01', path: '/blog/daily/2026-07-01.html' },
  { label: 'daily 2026-06-20', path: '/blog/daily/2026-06-20.html' },
  { label: 'daily 2026-07-05', path: '/blog/daily/2026-07-05.html' },
  { label: 'daily index', path: '/blog/daily/index.html' },
];

// Exhaustive list of all daily pages (generated from the repo)
const ALL_DAILY_PAGES = [
  '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26',
  '2026-06-27', '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01',
  '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06',
  '2026-07-07', '2026-07-08',
].map((d) => `/blog/daily/${d}.html`);

for (const pageCase of SPOT_CHECK_PAGES) {
  test.describe(`ZEMA-2918 daily skip-nav: ${pageCase.label}`, () => {
    test('skip-nav link targets a focusable #main-content', async ({ page }) => {
      await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });

      // 1. skip-nav link exists with correct href
      const skipLink = page.locator('a.skip-nav');
      await expect(skipLink).toHaveCount(1);
      await expect(skipLink).toHaveAttribute('href', '#main-content');

      // 2. exactly one #main-content target
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toHaveCount(1);

      // 3. target has tabindex="-1" (makes non-focusable tags programmatically focusable)
      await expect(mainContent).toHaveAttribute('tabindex', '-1');

      // 4. target is a semantic <article> (daily pages) or <section> (index)
      const expectedTag = pageCase.path.endsWith('index.html') ? 'SECTION' : 'ARTICLE';
      await expect(mainContent).toHaveJSProperty('tagName', expectedTag);
    });

    test('skip-nav link becomes visible on focus', async ({ page }) => {
      await page.goto(pageCase.path, { waitUntil: 'load' });
      await page.waitForTimeout(500);

      const skipLink = page.locator('a.skip-nav');

      // Before focus: CSS top is -100px (off-screen)
      const topBefore = await skipLink.evaluate(
        (el) => getComputedStyle(el).top
      );
      expect(topBefore).toBe('-100px');

      // Focus the skip-nav link directly
      await skipLink.focus();
      await expect(skipLink).toBeFocused();

      // After focus: CSS top transitions to 0px (visible)
      await expect(skipLink).toHaveCSS('top', '0px');
    });

    test('clicking skip-nav moves focus to #main-content', async ({ page }) => {
      await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });

      const skipLink = page.locator('a.skip-nav');
      const mainContent = page.locator('#main-content');

      // Focus and activate the skip link
      await skipLink.focus();
      await skipLink.press('Enter');

      // Focus should now be on #main-content (tabindex="-1" makes it focusable)
      await expect(mainContent).toBeFocused();
    });

    test('#main-content has no visible focus outline', async ({ page }) => {
      await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });

      const mainContent = page.locator('#main-content');
      await mainContent.focus();

      // CSS #main-content:focus { outline: none; } suppresses the ring
      const outlineStyle = await mainContent.evaluate(
        (el) => getComputedStyle(el).outlineStyle
      );
      expect(outlineStyle).toBe('none');
    });
  });
}

// Exhaustive sweep: every daily page must have tabindex="-1"
test.describe('ZEMA-2918 daily skip-nav: all daily pages', () => {
  for (const pagePath of ALL_DAILY_PAGES) {
    test(`${pagePath} has focusable #main-content`, async ({ page }) => {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });

      const mainContent = page.locator('#main-content');
      await expect(mainContent).toHaveCount(1);
      await expect(mainContent).toHaveAttribute('tabindex', '-1');
    });
  }
});
