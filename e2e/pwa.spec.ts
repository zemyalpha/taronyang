import { test, expect } from '@playwright/test';

test.describe('PWA — Web App Manifest', () => {
  test('manifest.json이 올바른 Content-Type으로 로드됨', async ({ page, request }) => {
    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);
    const ct = response.headers()['content-type'] || '';
    expect(ct).toContain('application/manifest+json');
  });

  test('manifest.json 필수 필드 검증', async ({ request }) => {
    const manifest = await request.get('/manifest.json').then(r => r.json());

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBe('타로냥');
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#0a0a2e');
    expect(manifest.background_color).toBe('#0a0a2e');
    expect(manifest.lang).toBe('ko-KR');
  });

  test('manifest.json 아이콘 구성 검증 (192/512/maskable)', async ({ request }) => {
    const manifest = await request.get('/manifest.json').then(r => r.json());

    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    const has192 = manifest.icons.some(i => i.sizes === '192x192');
    const has512 = manifest.icons.some(i => i.sizes === '512x512');
    const hasMaskable = manifest.icons.some(i => i.purpose === 'maskable');

    expect(has192).toBeTruthy();
    expect(has512).toBeTruthy();
    expect(hasMaskable).toBeTruthy();
  });

  test('manifest.json 아이콘 파일 실제 접근 가능', async ({ request }) => {
    const manifest = await request.get('/manifest.json').then(r => r.json());

    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), `Icon ${icon.src}`).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }
  });

  test('홈페이지에 manifest 링크 존재', async ({ page }) => {
    await page.goto('/');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
  });
});

test.describe('PWA — Service Worker', () => {
  test('sw.js가 올바른 헤더로 로드됨', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('javascript');
  });

  test('Service Worker 등록 및 활성화', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // SW 등록 확인
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return { registered: false };
      const sw = reg.active || reg.installing || reg.waiting;
      return {
        registered: true,
        state: sw?.state || 'unknown',
        scope: reg.scope,
      };
    });

    expect(swState.registered).toBeTruthy();
    expect(swState.scope).toContain('localhost:8000');
  });

  test('오프라인 폴백 동작', async ({ page, context }) => {
    // 페이지 로드 후 SW가 캐시 구축할 때까지 대기
    await page.goto('/');
    await page.waitForTimeout(3000);

    // 오프라인 모드 전환
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // 새로고침 — 오프라인 폴백 페이지 또는 캐시된 페이지 표시되어야 함
    const response = await page.reload();
    await page.waitForTimeout(2000);

    // 크래시하지 않고 페이지가 로드되어야 함
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    await context.setOffline(false);
  });
});

test.describe('PWA — HTML 메타태그', () => {
  const pages = [
    { name: '홈', path: '/' },
    { name: '타로', path: '/tarot' },
    { name: '일운', path: '/daily' },
    { name: '히스토리', path: '/history' },
    { name: '마이페이지', path: '/mypage' },
    { name: '로그인', path: '/login' },
    { name: '요금제', path: '/pricing' },
    { name: '관리자', path: '/admin' },
  ];

  for (const p of pages) {
    test(`${p.name} 페이지 PWA 메타태그`, async ({ page }) => {
      await page.goto(p.path);

      // manifest 링크
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveCount(1);

      // theme-color
      const themeColor = page.locator('meta[name="theme-color"]');
      await expect(themeColor).toHaveCount(1);

      // apple-mobile-web-app-capable
      const appleCapable = page.locator('meta[name="apple-mobile-web-app-capable"]');
      await expect(appleCapable).toHaveCount(1);

      // apple-touch-icon
      const appleIcon = page.locator('link[rel="apple-touch-icon"]');
      await expect(appleIcon).toHaveCount(1);

      // apple-mobile-web-app-title
      const appleTitle = page.locator('meta[name="apple-mobile-web-app-title"]');
      await expect(appleTitle).toHaveCount(1);
    });
  }
});

test.describe('PWA — 콘솔 에러 검증', () => {
  test('홈페이지 로드 시 콘솔 에러 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForTimeout(4000);

    // SW 등록 실패 등 치명적 에러가 없어야 함
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') && // non-critical
      !e.includes('net::ERR')
    );
    expect(criticalErrors, `Console errors: ${criticalErrors.join(', ')}`).toEqual([]);
  });
});

test.describe('PWA — 설치 배너', () => {
  test('beforeinstallprompt 이벤트 처리 코드 존재', async ({ page }) => {
    // app.js에 beforeinstallprompt 리스너가 있는지 확인 (간접 검증)
    const response = await page.goto('/');
    await page.waitForTimeout(1000);

    // app.js 소스 확인
    const appJs = await page.evaluate(async () => {
      const res = await fetch('/static/js/app.js');
      return res.text();
    });

    expect(appJs).toContain('beforeinstallprompt');
    expect(appJs).toContain('deferredInstallPrompt');
    expect(appJs).toContain('appinstalled');
    expect(appJs).toContain('INSTALL_DISMISS_KEY');
  });
});
