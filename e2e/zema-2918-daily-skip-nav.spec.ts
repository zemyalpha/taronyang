import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ZEMA-2918: blog/daily skip-nav tabindex fix verification
 *
 * Daily fortune pages (blog/daily/*.html) use a semantic <article> (or
 * <section> on the index) as the skip-nav target (#main-content), placed
 * after the header so the skip truly bypasses navigation. These tags are
 * not natively focusable, so tabindex="-1" must be present for the skip
 * link to move keyboard / screen-reader focus (WCAG 2.1 AA).
 */

const DAILY_DIR = join(__dirname, '..', 'frontend', 'blog', 'daily');
const ALL_DAILY_FILES = existsSync(DAILY_DIR)
  ? readdirSync(DAILY_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
  : [];

// Spot-check representative pages: pick dynamically from files on disk so
// the tests don't break if old daily pages are cleaned up or dates change.
const SPOT_CHECK_PAGES = [
  ...ALL_DAILY_FILES.slice(0, 3).map((file) => ({
    label: 'daily ' + file.replace('.html', ''),
    path: '/blog/daily/' + file,
  })),
  { label: 'daily index', path: '/blog/daily/index.html' },
];

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
      await page.goto(pageCase.path);

      const skipLink = page.locator('a.skip-nav');

      // Before focus: CSS top is -100px (off-screen)
      await expect(skipLink).toHaveCSS('top', '-100px');

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
      await page.goto(pageCase.path);

      const mainContent = page.locator('#main-content');
      await mainContent.focus();

      // CSS #main-content:focus { outline: none; } suppresses the ring
      await expect(mainContent).toHaveCSS('outline-style', 'none');
    });
  });
}

// Exhaustive sweep: every daily page must have a focusable #main-content.
// Reads files directly from disk (no browser navigation) for speed.
// All files are checked in a single test case to avoid test-runner startup
// overhead and report clutter as the number of daily pages grows.
test('all daily pages: #main-content has tabindex="-1" (static sweep)', () => {
  expect(ALL_DAILY_FILES.length).toBeGreaterThan(0);
  const failures: string[] = [];

  for (const file of ALL_DAILY_FILES) {
    const html = readFileSync(join(DAILY_DIR, file), 'utf8');
    const cleanHtml = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    const allMatches = cleanHtml.match(/\sid\s*=\s*(["']?)main-content\1/gi) || [];
    if (allMatches.length === 0) {
      failures.push(`${file}: missing id="main-content"`);
      continue;
    }
    if (allMatches.length > 1) {
      failures.push(`${file}: multiple elements with id="main-content"`);
      continue;
    }

    const tagMatch = cleanHtml.match(/<\w[^>]*\sid\s*=\s*(["']?)main-content\1[^>]*>/i);
    if (!tagMatch) {
      failures.push(`${file}: missing id="main-content"`);
      continue;
    }

    if (!/\btabindex\s*=\s*(["']?)-1\1/i.test(tagMatch[0])) {
      failures.push(`${file}: #main-content must have tabindex="-1"`);
    }
  }

  expect(
    failures,
    `${failures.length} of ${ALL_DAILY_FILES.length} daily pages failed the skip-nav static check:\n${failures.join('\n')}`
  ).toHaveLength(0);
});
