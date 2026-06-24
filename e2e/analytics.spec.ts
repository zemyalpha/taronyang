import { test, expect } from '@playwright/test';

test.describe('사용자 추적 분석 도구 (ZEMA-2638 / ZEMA-2639)', () => {
  test.describe('POST /api/analytics/event — 이벤트 수집', () => {
    test('단일 이벤트 저장', async ({ request }) => {
      const res = await request.post('/api/analytics/event', {
        data: {
          events: [
            {
              name: 'page_view',
              props: { path: '/tarot' },
              path: '/tarot',
              session_id: `e2e-${Date.now()}`,
              ts: new Date().toISOString(),
            },
          ],
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.stored).toBe(1);
    });

    test('여러 이벤트 배치 저장', async ({ request }) => {
      const res = await request.post('/api/analytics/event', {
        data: {
          events: [
            { name: 'page_view', path: '/' },
            { name: 'tarot_reading_complete', props: { category: 'love' }, path: '/tarot' },
            { name: 'cta_click', path: '/' },
          ],
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.stored).toBe(3);
    });

    test('배치 크기 제한 (25개 → 20개 캡)', async ({ request }) => {
      const events = Array.from({ length: 25 }, (_, i) => ({ name: `evt_${i}` }));
      const res = await request.post('/api/analytics/event', {
        data: { events },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.stored).toBe(20);
    });

    test('빈 events 배열 → 400', async ({ request }) => {
      const res = await request.post('/api/analytics/event', {
        data: { events: [] },
      });
      expect(res.status()).toBe(400);
    });

    test('events 필드 누락 → 400', async ({ request }) => {
      const res = await request.post('/api/analytics/event', {
        data: {},
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('GET /api/analytics/summary — 관리자 요약 (권한)', () => {
    test('인증 없이 접근 → 401', async ({ request }) => {
      const res = await request.get('/api/analytics/summary');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('프론트엔드 analytics.js 통합', () => {
    test('TaronyangAnalytics 전역 객체 노출', async ({ page }) => {
      await page.goto('/');
      const exposed = await page.evaluate(() => typeof window.TaronyangAnalytics === 'object');
      expect(exposed).toBeTruthy();
    });

    test('track() 함수 사용 가능', async ({ page }) => {
      await page.goto('/');
      const hasTrack = await page.evaluate(
        () => typeof window.TaronyangAnalytics?.track === 'function',
      );
      expect(hasTrack).toBeTruthy();
    });

    test('track() 호출이 에러 없이 동작 (앱 크래치 방지)', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto('/');
      await page.evaluate(() => {
        (window as any).TaronyangAnalytics.track('e2e_test_event', { source: 'playwright' });
      });
      // analytics 실패가 앱을 깨뜨리지 않아야 함
      expect(errors.filter((e) => !e.includes('analytics'))).toHaveLength(0);
    });
  });
});
