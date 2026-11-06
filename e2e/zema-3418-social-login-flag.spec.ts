import { test, expect } from '@playwright/test';

// ZEMA-3418: 소셜 로그인 UI는 OAuth 자격증명이 서버에 설정되기 전까지
// config 플래그(window.__TARONYANG_CONFIG__.socialLoginEnabled)로 숨겨진다.

test.describe('ZEMA-3418: 소셜 로그인 UI 기능 플래그', () => {
  test('기본(플래그 미설정): 소셜 로그인 섹션이 표시되지 않는다', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#social-login-section')).toBeHidden();
    await expect(page.locator('#social-buttons button')).toHaveCount(3);
    await expect(page.locator('#social-buttons button').first()).not.toBeVisible();
  });

  test('플래그 활성화: socialLoginEnabled=true → 섹션이 다시 표시된다', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TARONYANG_CONFIG__ = { socialLoginEnabled: true };
    });
    await page.goto('/login');

    await expect(page.locator('#social-login-section')).toBeVisible();
    await expect(page.locator('#social-buttons button')).toHaveCount(3);
    await expect(page.locator('#social-buttons button').first()).toBeVisible();
  });

  test('다른 페이지에는 영향 없음: 메인 페이지 정상 로드', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#social-login-section')).toHaveCount(0);
  });
});
