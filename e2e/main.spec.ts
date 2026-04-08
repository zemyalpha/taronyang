import { test, expect } from '@playwright/test';

test.describe('메인 페이지', () => {
  test('페이지 로드 및 기본 요소 확인', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/타로냥/);
    await expect(page.locator('.hero-title')).toHaveText('타로냥');
    await expect(page.locator('.hero-subtitle')).toHaveText('AI 타로로 당신의 이야기를 듣다');
    await expect(page.locator('.cta-button')).toHaveText('지금 타로 보기 →');
  });

  test('카테고리 그리드 6개 표시', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.category-card');
    await expect(cards).toHaveCount(6);
  });

  test('CTA 버튼 클릭 → 타로 페이지 이동', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cta-button').click();
    await expect(page).toHaveURL(/\/tarot/);
  });

  test('카테고리 카드 클릭 → 타로 페이지 (cat 파라미터)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.category-card').first().click();
    await expect(page).toHaveURL(/\/tarot/);
  });

  test('오늘의 한 줄 운세 표시', async ({ page }) => {
    await page.goto('/');
    const dailyText = page.locator('#daily-text');
    await expect(dailyText).not.toHaveText('로딩 중...');
  });

  test('통계 숫자 표시', async ({ page }) => {
    await page.goto('/');
    const count = page.locator('#today-count');
    await expect(count).not.toHaveText('-');
  });

  test('로그인 링크 동작', async ({ page }) => {
    await page.goto('/');
    const loginLink = page.locator('.header-login');
    await expect(loginLink).toHaveText('로그인');
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
