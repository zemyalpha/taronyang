import { test, expect } from '@playwright/test';

test.describe('인증', () => {
  test('로그인 페이지 로드', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/로그인/);
    await expect(page.locator('#form-login')).toBeVisible();
    await expect(page.locator('#tab-signup')).toBeVisible();
  });

  test('회원가입 탭 전환', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#tab-signup').click();
    await expect(page.locator('#form-signup')).toBeVisible();
    await expect(page.locator('#form-login')).toHaveClass(/hidden/);
  });

  test('회원가입 → 로그인 전체 플로우', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;
    await page.goto('/login');

    await page.locator('#tab-signup').click();
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill('test1234');
    await page.locator('#signup-nickname').fill('테스트냥');
    await page.locator('#form-signup button[type="submit"]').click();

    await expect(page).toHaveURL(/\/(static\/)?index\.html|\/$/, { timeout: 5000 });
  });

  test('로그인 실패 → 에러 메시지', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill('nonexist@test.com');
    await page.locator('#login-password').fill('wrongpass');
    await page.locator('#form-login button[type="submit"]').click();

    await expect(page.locator('#login-error')).toBeVisible({ timeout: 3000 });
  });

  test('비회원 이용 링크', async ({ page }) => {
    await page.goto('/login');
    await page.locator('a', { hasText: '비회원으로 이용하기' }).click();
    await expect(page).toHaveURL(/\/tarot/);
  });
});
