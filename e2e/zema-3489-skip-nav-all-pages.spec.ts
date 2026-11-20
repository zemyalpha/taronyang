import { test, expect } from '@playwright/test';

/**
 * ZEMA-3489 / ZEMA-3490: skip-nav + main-content landmark verification
 *
 * All 8 core app pages must provide a WCAG 2.4.1 "Bypass Blocks" path:
 *   1. an <a class="skip-nav"> link with href="#main-content"
 *   2. exactly one element with id="main-content"
 *   3. that target carries tabindex="-1" so focus actually moves to it
 *      (a bare id only scrolls — it does not move focus for keyboard /
 *       screen-reader users)
 *   4. clicking the skip link moves programmatic focus to #main-content
 *
 * Pages covered: /, /tarot, /daily, /history, /mypage, /login, /pricing, /faq
 */

const PAGES = [
  { label: 'home',     path: '/'         },
  { label: 'tarot',    path: '/tarot'    },
  { label: 'daily',    path: '/daily'    },
  { label: 'history',  path: '/history'  },
  { label: 'mypage',   path: '/mypage'   },
  { label: 'login',    path: '/login'    },
  { label: 'pricing',  path: '/pricing'  },
  { label: 'faq',      path: '/faq'      },
];

for (const { label, path } of PAGES) {
  test.describe(`ZEMA-3489 skip-nav: ${label} (${path})`, () => {
    test('skip-nav link exists and targets #main-content', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const skipLink = page.locator('a.skip-nav');
      await expect(skipLink).toHaveCount(1);
      await expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    test('exactly one #main-content target with tabindex="-1"', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const mainContent = page.locator('#main-content');
      await expect(mainContent).toHaveCount(1);
      await expect(mainContent).toHaveAttribute('tabindex', '-1');
    });

    test('activating skip-nav moves focus to #main-content', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const skipLink = page.locator('a.skip-nav');
      const mainContent = page.locator('#main-content');

      await skipLink.focus();
      await skipLink.press('Enter');

      // tabindex="-1" is what makes the target programmatically focusable
      await expect(mainContent).toBeFocused();
    });
  });
}
