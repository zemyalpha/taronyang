import { test, expect } from '@playwright/test';

test.describe('ZEMA-3196: Admin config.js load order + API base + error handling', () => {
  test('loadReadings 가 정의되어 있음 (ReferenceError 없음)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ total_users: 0, premium_users: 0, total_readings: 0, today_new_users: 0 }),
      }),
    );
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ users: [] }) }),
    );
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-admin-token'));
    await page.goto('/admin/index.html');
    await page.waitForTimeout(1500);

    expect(errors).toEqual([]);
  });

  test('통계 API 정상 응답 → 데이터 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ total_users: 100, premium_users: 25, total_readings: 500, today_new_users: 10 }),
      }),
    );
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ users: [] }) }),
    );
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-admin-token'));
    await page.goto('/admin/index.html');

    await expect(page.locator('#stat-users')).toHaveText('100', { timeout: 5000 });
    await expect(page.locator('#stat-premium')).toHaveText('25');
    await expect(page.locator('#stat-readings')).toHaveText('500');
    await expect(page.locator('#stat-today')).toHaveText('10');
  });

  test('통계 API 실패 → "오류" 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) => route.abort('failed'));
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ users: [] }) }),
    );
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-admin-token'));
    await page.goto('/admin/index.html');

    await expect(page.locator('#stat-users')).toHaveText('오류', { timeout: 5000 });
    await expect(page.locator('#stat-readings')).toHaveText('오류');
  });

  test('사용자 API 실패 → 에러 메시지 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ total_users: 0, premium_users: 0, total_readings: 0, today_new_users: 0 }),
      }),
    );
    await page.route('**/api/admin/users**', (route) => route.abort('failed'));
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'fake-admin-token'));
    await page.goto('/admin/index.html');

    await expect(page.locator('#users-table')).toContainText('불러오지 못했습니다', { timeout: 5000 });
  });

  test('상담 기록 API 실패 → 에러 메시지 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ total_users: 0, premium_users: 0, total_readings: 0, today_new_users: 0 }),
      }),
    );
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ users: [] }) }),
    );
    await page.route('**/api/admin/readings**', (route) => route.abort('failed'));

    await page.addInitScript(() => localStorage.setItem('token', 'fake-admin-token'));
    await page.goto('/admin/index.html');
    await page.locator('#tab-readings').click();

    await expect(page.locator('#readings-table')).toContainText('불러오지 못했습니다', { timeout: 5000 });
  });

  test('401 응답 → 홈으로 리다이렉트', async ({ page }) => {
    await page.route('**/api/admin/**', (route) =>
      route.fulfill({ status: 401, body: '{}' }),
    );

    await page.addInitScript(() => localStorage.setItem('token', 'invalid-token'));
    await page.goto('/admin/index.html');

    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
  });
});
