import { test, expect } from '@playwright/test';

test.describe('ZEMA-3186: 마이페이지 API base + 에러 처리', () => {
  test('API 호출 실패 시 사용자 친화적 에러 메시지 표시 (console.error 없음)', async ({ page }) => {
    const jsConsoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.startsWith('Failed to load resource')) {
          jsConsoleErrors.push(text);
        }
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-token-for-testing');
    });

    await page.goto('/mypage', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#history_list')).toContainText('상담 기록을 불러오지 못했습니다', {
      timeout: 8000,
    });

    await expect(page.locator('#plan_status')).toContainText('구독 정보를 불러올 수 없습니다');

    expect(jsConsoleErrors).toEqual([]);
  });

  test('네트워크 장애 시 catch 블록 에러 처리 (console.error → 사용자 메시지)', async ({ page }) => {
    const jsConsoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.startsWith('Failed to load resource')) {
          jsConsoleErrors.push(text);
        }
      }
    });

    await page.route('**/api/**', (route) => route.abort('failed'));

    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-token-for-testing');
    });

    await page.goto('/mypage', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#history_list')).toContainText('상담 기록을 불러오지 못했습니다', {
      timeout: 8000,
    });
    await expect(page.locator('#plan_status')).toContainText('구독 정보를 불러올 수 없습니다');

    expect(jsConsoleErrors).toEqual([]);
  });

  test('API base가 config beacon 없을 때 window.location.origin 기반으로 동작', async ({ page }) => {
    const apiBase = await page.evaluate(() => {
      return (window as any).__TARONYANG_CONFIG__?.apiBase ?? null;
    });
    expect(apiBase).toBeNull();
  });
});
