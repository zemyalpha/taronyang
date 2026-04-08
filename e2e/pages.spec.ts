import { test, expect } from '@playwright/test';

test.describe('상담 기록 페이지', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveTitle(/상담 기록/);
  });

  test('비로그인 → 로그인 안내 표시', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('#need-login')).toBeVisible();
  });
});

test.describe('오늘의 운세 페이지', () => {
  test('페이지 로드 및 별자리 선택 표시', async ({ page }) => {
    await page.goto('/daily');
    await expect(page).toHaveTitle(/오늘의 운세/);
    const zodiacButtons = page.locator('.z-btn');
    await expect(zodiacButtons).toHaveCount(12);
  });

  test('별자리 선택 → 운세 로딩 → 결과 표시', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/daily');
    await page.locator('.z-btn').first().click();
    await expect(page.locator('#loading')).toBeVisible();
    await expect(page.locator('#result')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('#result-zodiac')).toHaveText('양자리');
    await expect(page.locator('#result-detail')).not.toBeEmpty();
  });
});

test.describe('마이페이지', () => {
  test('비로그인 → 리다이렉트', async ({ page }) => {
    await page.goto('/mypage');
    await page.waitForURL(/\/$/, { timeout: 5000 }).catch(() => {});
    expect(page.url()).toMatch(/\/$/);
  });
});

test.describe('요금제 페이지', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/pricing');
    expect(page.url()).toContain('/pricing');
  });
});
