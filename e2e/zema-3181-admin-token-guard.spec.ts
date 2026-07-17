import { test, expect } from '@playwright/test';

test.describe('ZEMA-3181: Admin null token guard + error handling', () => {
  test('토큰 없음 → /login 으로 리다이렉트', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('token'));

    await page.goto('/admin/index.html');

    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('토큰 없음 → Authorization: Bearer null API 호출 발생 안 함', async ({ page }) => {
    const apiCalls: string[] = [];

    await page.route('**/api/admin/**', (route) => {
      apiCalls.push(route.request().url());
      return route.fulfill({ status: 401, body: '{}' });
    });

    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('token'));

    await page.goto('/admin/index.html');

    await page.waitForTimeout(1500);

    expect(apiCalls).toEqual([]);
  });

  test('토큰 있음 + 통계 API 네트워크 실패 → "오류" 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.abort('failed'),
    );
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ users: [] }) }),
    );
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-admin-token');
    });

    await page.goto('/admin/index.html');

    await expect(page.locator('#stat-users')).toHaveText('오류', { timeout: 5000 });
    await expect(page.locator('#stat-premium')).toHaveText('오류');
    await expect(page.locator('#stat-readings')).toHaveText('오류');
    await expect(page.locator('#stat-today')).toHaveText('오류');
  });

  test('토큰 있음 + 사용자 목록 API 네트워크 실패 → "불러오지 못했습니다" 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          total_users: 0,
          premium_users: 0,
          total_readings: 0,
          today_new_users: 0,
        }),
      }),
    );
    await page.route('**/api/admin/users**', (route) => route.abort('failed'));
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-admin-token');
    });

    await page.goto('/admin/index.html');

    await expect(page.locator('#users-table')).toContainText('불러오지 못했습니다', {
      timeout: 5000,
    });
  });

  test('토큰 있음 + 상담 기록 API 네트워크 실패 → "불러오지 못했습니다" 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          total_users: 0,
          premium_users: 0,
          total_readings: 0,
          today_new_users: 0,
        }),
      }),
    );
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ users: [] }) }),
    );
    await page.route('**/api/admin/readings**', (route) => route.abort('failed'));

    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-admin-token');
    });

    await page.goto('/admin/index.html');

    await page.locator('#tab-readings').click();

    await expect(page.locator('#readings-table')).toContainText('불러오지 못했습니다', {
      timeout: 5000,
    });
  });

  test('토큰 있음 + 정상 응답 → 통계 데이터 표시', async ({ page }) => {
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          total_users: 100,
          premium_users: 25,
          total_readings: 500,
          today_new_users: 10,
        }),
      }),
    );
    await page.route('**/api/admin/users**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          users: [
            {
              email: 'test@example.com',
              nickname: '테스트',
              created_at: '2026-07-01',
              subscription_status: 'premium',
            },
          ],
        }),
      }),
    );
    await page.route('**/api/admin/readings**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ readings: [] }) }),
    );

    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-admin-token');
    });

    await page.goto('/admin/index.html');

    await expect(page.locator('#stat-users')).toHaveText('100', { timeout: 5000 });
    await expect(page.locator('#stat-premium')).toHaveText('25');
    await expect(page.locator('#stat-readings')).toHaveText('500');
    await expect(page.locator('#stat-today')).toHaveText('10');
  });
});
