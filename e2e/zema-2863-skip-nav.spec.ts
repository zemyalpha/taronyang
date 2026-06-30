import { test, expect } from '@playwright/test';

/**
 * ZEMA-2863: a11y skip-nav fix verification
 *
 * Every page with a `.skip-nav` link must have a matching `#main-content`
 * element that is focusable (tabindex="-1"), so keyboard users can skip
 * directly to main content (WCAG 2.1 AA).
 */

const PAGES: { label: string; path: string; tag: string }[] = [
  // <article> pattern (16 blog posts that had no id/tabindex)
  { label: 'major-arcana-guide (article)', path: '/blog/major-arcana-guide.html', tag: 'ARTICLE' },
  { label: 'tarot-spreads-guide (article)', path: '/blog/tarot-spreads-guide.html', tag: 'ARTICLE' },
  { label: 'yes-no-tarot (article)', path: '/blog/yes-no-tarot.html', tag: 'ARTICLE' },
  // <article> with pre-existing id (5 blog posts, tabindex added)
  { label: 'health-fortune-tarot (article+id)', path: '/blog/health-fortune-tarot.html', tag: 'ARTICLE' },
  { label: 'single-fortune-tarot (article+id)', path: '/blog/single-fortune-tarot.html', tag: 'ARTICLE' },
  // <section> pattern (index + faq — target moved past header per Gemini review)
  { label: 'index (section)', path: '/', tag: 'SECTION' },
  { label: 'faq (section)', path: '/faq.html', tag: 'SECTION' },
  // <main> pattern (tarot)
  { label: 'tarot (main)', path: '/tarot.html', tag: 'MAIN' },
];

for (const pageCase of PAGES) {
  test.describe(`ZEMA-2863 skip-nav: ${pageCase.label}`, () => {
    test('skip-nav link targets a focusable #main-content', async ({ page }) => {
      await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });

      // 1. skip-nav link exists with correct href
      const skipLink = page.locator('a.skip-nav');
      await expect(skipLink).toHaveCount(1);
      await expect(skipLink).toHaveAttribute('href', '#main-content');

      // 2. exactly one #main-content target
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toHaveCount(1);

      // 3. target has tabindex="-1" (makes it programmatically focusable)
      await expect(mainContent).toHaveAttribute('tabindex', '-1');

      // 4. target is the expected semantic element
      await expect(mainContent).toHaveJSProperty('tagName', pageCase.tag);
    });

    test('skip-nav link becomes visible on focus', async ({ page }) => {
      await page.goto(pageCase.path, { waitUntil: 'load' });
      // Let any page-load JS that auto-focuses elements settle first
      await page.waitForTimeout(500);

      const skipLink = page.locator('a.skip-nav');

      // Before focus: CSS top is -100px (off-screen)
      const topBefore = await skipLink.evaluate(
        (el) => getComputedStyle(el).top
      );
      expect(topBefore).toBe('-100px');

      // Focus the skip-nav link directly (tab-order varies by page)
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
  });
}
