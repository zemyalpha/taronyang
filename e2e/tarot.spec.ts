import { test, expect } from '@playwright/test';

test.describe('타로 상담 페이지', () => {
  test('페이지 로드 및 카테고리 선택 표시', async ({ page }) => {
    await page.goto('/tarot');
    await expect(page).toHaveTitle(/타로 상담/);
    await expect(page.locator('#step-category')).toBeVisible();
    const buttons = page.locator('.cat-btn');
    await expect(buttons).toHaveCount(4);
  });

  test('카테고리 선택 → 질문 입력 단계 전환', async ({ page }) => {
    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await expect(page.locator('#step-question')).toBeVisible();
    await expect(page.locator('#step-category')).toHaveClass(/hidden/);
  });

  test('카드 뽑기 → 셔플 카드 표시', async ({ page }) => {
    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#loading')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });
  });

  test('카드 3장 선택 → 해석 버튼 활성화', async ({ page }) => {
    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });

    const cards = page.locator('#card-area .tarot-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();

    await expect(page.locator('#selected-count')).toHaveText('3');
    await expect(page.locator('#btn-read')).toBeEnabled();
  });

  test('타로 해석 전체 플로우', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });

    const cards = page.locator('#card-area .tarot-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();

    await page.locator('#btn-read').click();
    await expect(page.locator('#step-result')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('#result-text')).not.toBeEmpty({ timeout: 45000 });
  });

  test('이전 버튼 동작', async ({ page }) => {
    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await expect(page.locator('#step-question')).toBeVisible();
    await page.locator('button', { hasText: '이전' }).click();
    await expect(page.locator('#step-category')).toBeVisible();
  });

  test('다시 상담받기 → 초기화', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });

    const cards = page.locator('#card-area .tarot-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();
    await page.locator('#btn-read').click();
    await expect(page.locator('#step-result')).toBeVisible({ timeout: 45000 });

    await page.locator('button', { hasText: '다시 상담받기' }).click();
    await expect(page.locator('#step-category')).toBeVisible();
  });
});
