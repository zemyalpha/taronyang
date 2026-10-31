import { test, expect } from '@playwright/test';

test.describe('상담 기록 — 오류/빈 상태 분리 (ZEMA-3187)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-token-for-testing');
    });
  });

  test('네트워크 실패 시 오류 상태 표시 (빈 상태 아님)', async ({ page }) => {
    await page.route('**/api/readings', (route) => route.abort('failed'));
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#error-state')).toBeVisible();
    await expect(page.locator('#empty-state')).toBeHidden();
  });

  test('HTTP 500 서버 오류 시 오류 상태 표시 (빈 상태 아님)', async ({ page }) => {
    await page.route('**/api/readings', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    );
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#error-state')).toBeVisible();
    await expect(page.locator('#empty-state')).toBeHidden();
  });

  test('HTTP 502 백엔드 연결 불가 시 오류 상태 표시', async ({ page }) => {
    await page.route('**/api/readings', (route) =>
      route.fulfill({ status: 502, json: { error: 'Backend unreachable' } }),
    );
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#error-state')).toBeVisible();
    await expect(page.locator('#empty-state')).toBeHidden();
  });

  test('빈 배열 응답 시 빈 상태 표시 (오류 상태 아님)', async ({ page }) => {
    await page.route('**/api/readings', (route) =>
      route.fulfill({ status: 200, json: [] }),
    );
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#error-state')).toBeHidden();
  });

  test('오류 상태에서 다시 시도 버튼 클릭 시 재요청', async ({ page }) => {
    let attempt = 0;
    await page.route('**/api/readings', (route) => {
      attempt += 1;
      if (attempt === 1) {
        return route.fulfill({ status: 500, body: 'error' });
      }
      return route.fulfill({ status: 200, json: [] });
    });
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#error-state')).toBeVisible();
    await page.locator('#error-state button', { hasText: '다시 시도' }).click();
    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#error-state')).toBeHidden();
    expect(attempt).toBe(2);
  });
});
