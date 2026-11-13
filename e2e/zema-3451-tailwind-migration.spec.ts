import { test, expect } from '@playwright/test';

// The 7 pages that previously loaded the Tailwind Play CDN.
// index.html and faq.html never used the CDN (CSP-only change) so they are excluded.
const AFFECTED_PAGES = [
  { path: '/tarot', name: 'tarot' },
  { path: '/daily', name: 'daily' },
  { path: '/history', name: 'history' },
  { path: '/mypage', name: 'mypage' },
  { path: '/pricing', name: 'pricing' },
  { path: '/login', name: 'login' },
];

test.describe('ZEMA-3451: Tailwind Play CDN → precompiled CSS migration', () => {
  for (const { path, name } of AFFECTED_PAGES) {
    test(`${name}: precompiled CSS linked, no CDN, no CSP errors`, async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(String(err));
      });
      page.on('requestfailed', (req) => {
        consoleErrors.push(`REQUEST FAILED: ${req.url()} ${req.failure()?.errorText}`);
      });

      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // No CDN script tag present
      const cdnScript = page.locator('script[src*="cdn.tailwindcss.com"]');
      await expect(cdnScript).toHaveCount(0);

      // Precompiled CSS link present
      const cssLink = page.locator('link[href="/static/css/tailwind.css"]');
      await expect(cssLink).toHaveCount(1);

      // CSP must not contain unsafe-eval or cdn.tailwindcss.com
      const cspMeta = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute('content');
      expect(cspMeta).not.toContain('unsafe-eval');
      expect(cspMeta).not.toContain('cdn.tailwindcss.com');

      // Only flag CSP/Tailwind-related console errors (ignore expected 401/network noise)
      const relevantErrors = consoleErrors.filter(
        (e) =>
          e.includes('Content-Security-Policy') ||
          e.includes('tailwind') ||
          e.includes('cdn.tailwindcss.com') ||
          e.includes('Refused to')
      );
      expect(relevantErrors, `CSP/Tailwind errors on ${name}:\n${relevantErrors.join('\n')}`).toEqual([]);

      // Tailwind preflight is applied (body margin reset to 0)
      const bodyMargin = await page.evaluate(() => window.getComputedStyle(document.body).margin);
      expect(bodyMargin).toBe('0px');
    });
  }

  test('custom theme colors render with correct values (classes used in source)', async ({ page }) => {
    await page.goto('/tarot', { waitUntil: 'domcontentloaded' });

    // Probe classes that are ACTUALLY used in the source files.
    const colors = await page.evaluate(() => {
      const probes: Record<string, string> = {};
      const defs: Array<[string, string]> = [
        ['bg-navy', 'background-color'],
        ['text-lavender', 'color'],
        ['text-gold', 'color'],
        ['text-softgreen', 'color'],
        ['text-softred', 'color'],
        ['border-lavender', 'border-color'],
      ];
      for (const [cls, prop] of defs) {
        const el = document.createElement('div');
        el.className = cls;
        el.style.display = 'none';
        document.body.appendChild(el);
        probes[cls] = window.getComputedStyle(el)[prop as 'color'];
        el.remove();
      }
      return probes;
    });

    // navy #0a0a2e
    expect(colors['bg-navy']).toBe('rgb(10, 10, 46)');
    // lavender #a78bfa
    expect(colors['text-lavender']).toBe('rgb(167, 139, 250)');
    expect(colors['border-lavender']).toBe('rgb(167, 139, 250)');
    // gold #fbbf24
    expect(colors['text-gold']).toBe('rgb(251, 191, 36)');
    // softgreen #86efac
    expect(colors['text-softgreen']).toBe('rgb(134, 239, 172)');
    // softred #fca5a5
    expect(colors['text-softred']).toBe('rgb(252, 165, 165)');
  });

  test('opacity variant classes render correctly (used in source)', async ({ page }) => {
    await page.goto('/tarot', { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(() => {
      const probes: Record<string, string> = {};
      // These opacity variants are used throughout tarot.html and daily.html
      const defs: Array<[string, string]> = [
        ['bg-dark-purple/60', 'background-color'],
        ['bg-navy/80', 'background-color'],
        ['border-lavender/20', 'border-color'],
        ['text-lavender/60', 'color'],
      ];
      for (const [cls, prop] of defs) {
        const el = document.createElement('div');
        el.className = cls;
        el.style.display = 'none';
        document.body.appendChild(el);
        probes[cls] = window.getComputedStyle(el)[prop as 'color'];
        el.remove();
      }
      return probes;
    });

    // dark-purple #1a1a3e /60% → rgba(26, 26, 62, 0.6)
    expect(result['bg-dark-purple/60']).toContain('26');
    expect(result['bg-dark-purple/60']).toContain('62');
    expect(result['bg-dark-purple/60']).toMatch(/0\.6/);
    // navy #0a0a2e /80% → rgba(10, 10, 46, 0.8)
    expect(result['bg-navy/80']).toContain('10');
    expect(result['bg-navy/80']).toContain('46');
    expect(result['bg-navy/80']).toMatch(/0\.8/);
    // lavender border /20% → rgba(167, 139, 250, 0.2)
    expect(result['border-lavender/20']).toContain('167');
    expect(result['border-lavender/20']).toMatch(/0\.2/);
    // lavender text /60%
    expect(result['text-lavender/60']).toContain('167');
    expect(result['text-lavender/60']).toMatch(/0\.6/);
  });

  test('line-clamp-3 utility works (used in history.html)', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    const clamp = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'line-clamp-3';
      el.style.display = 'none';
      document.body.appendChild(el);
      const style = window.getComputedStyle(el);
      const val = (style as unknown as Record<string, string>)['-webkit-line-clamp'] || style.lineClamp;
      el.remove();
      return val;
    });
    expect(clamp?.toString()).toBe('3');
  });

  test('actual page elements receive Tailwind styles (bg-navy body)', async ({ page }) => {
    await page.goto('/tarot', { waitUntil: 'domcontentloaded' });
    // body has class "bg-navy" → should have the navy background applied
    const bgColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bgColor).toBe('rgb(10, 10, 46)');
  });

  test('admin page links precompiled CSS (was CDN user)', async ({ page }) => {
    // Admin does a client-side redirect when localStorage has no 'user'
    // and when /api/admin/stats returns 401. Stub both so the page stays put.
    await page.addInitScript(() => {
      window.localStorage.setItem('user', JSON.stringify({ token: 'qa-stub' }));
    });
    await page.route('**/api/admin/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.goto('/admin/', { waitUntil: 'domcontentloaded' });

    const cdnScript = page.locator('script[src*="cdn.tailwindcss.com"]');
    await expect(cdnScript).toHaveCount(0);

    const cssLink = page.locator('link[href="/static/css/tailwind.css"]');
    await expect(cssLink).toHaveCount(1);
  });
});
