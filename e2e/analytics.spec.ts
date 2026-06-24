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
      const exposed = await page.evaluate(() => {
        const analytics = (window as any).TaronyangAnalytics;
        return analytics !== undefined && analytics !== null && typeof analytics === 'object';
      });
      expect(exposed).toBeTruthy();
    });

    test('track() 함수 사용 가능', async ({ page }) => {
      await page.goto('/');
      const hasTrack = await page.evaluate(() => {
        const analytics = (window as any).TaronyangAnalytics;
        return !!analytics && typeof analytics.track === 'function';
      });
      expect(hasTrack).toBeTruthy();
    });

    test('track() 배치 flush 후에도 에러 없이 동작 (앱 크래시 방지)', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      // API 요청 실패 상황 시뮬레이션 — analytics.js가 실패를 안전하게 무시해야 함
      await page.route('**/api/analytics/event', (route) => route.abort('failed'));

      await page.goto('/');

      // MAX_QUEUE(10)만큼 호출하여 즉시 flush 유도. route.abort()로 인해
      // 응답이 돌아오지 않으므로 waitForResponse 대신 waitForRequest로
      // 요청이 실제로 발생했는지만 확인한다.
      const requestPromise = page.waitForRequest('**/api/analytics/event');
      await page.evaluate(() => {
        const analytics = (window as any).TaronyangAnalytics;
        for (let i = 0; i < 10; i++) {
          analytics.track('e2e_test_event', { source: 'playwright' });
        }
      });
      await requestPromise;

      // 어떠한 uncaught 런타임 에러도 발생하지 않아야 함 (필터링 없이)
      expect(errors).toHaveLength(0);
    });
  });
});
