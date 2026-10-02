import { test, expect } from '@playwright/test';

test.describe('ZEMA-3198: Pricing config.js load order + API base + error handling', () => {
  test('페이지 로드 시 ReferenceError 없음 (config.js → getApiBase 로드 순서)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.route('**/api/payment/status', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ status: 'free' }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-token'));
    await page.goto('/pricing');

    await expect(page.locator('#status-badge')).toHaveText('🆓 무료 플랜', { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('프리미엄 상태 → 프리미엄 배지 + 구독 버튼 비활성화', async ({ page }) => {
    await page.route('**/api/payment/status', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ status: 'premium' }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-token'));
    await page.goto('/pricing');

    await expect(page.locator('#status-badge')).toHaveText('💎 프리미엄 구독 중', { timeout: 5000 });
    await expect(page.locator('#btn-subscribe')).toBeDisabled();
    await expect(page.locator('#btn-subscribe')).toHaveText('이미 구독 중입니다');
  });

  test('결제 상태 API 네트워크 실패 → 에러 토스트 표시', async ({ page }) => {
    await page.route('**/api/payment/status', (route) => route.abort('failed'));

    await page.addInitScript(() => localStorage.setItem('token', 'fake-token'));
    await page.goto('/pricing');

    await expect(page.locator('#toast')).toContainText('구독 상태를 불러오지 못했습니다', { timeout: 5000 });
  });

  test('결제 상태 API HTTP 500 → 에러 토스트 표시', async ({ page }) => {
    await page.route('**/api/payment/status', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ detail: 'server error' }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-token'));
    await page.goto('/pricing');

    await expect(page.locator('#toast')).toContainText('구독 상태를 불러오지 못했습니다', { timeout: 5000 });
  });

  test('토큰 없이 구독 버튼 클릭 → 로그인 안내 토스트', async ({ page }) => {
    await page.goto('/pricing');

    await page.locator('#btn-subscribe').click();
    await expect(page.locator('#toast')).toContainText('로그인이 필요합니다', { timeout: 5000 });
  });
});
