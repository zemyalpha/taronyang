import { test, expect } from '@playwright/test';

// Mock shuffle success payload (10 cards)
const MOCK_SHUFFLE = {
  cards: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    symbol: '🌟',
    name: `카드${i + 1}`,
    name_en: `Card${i + 1}`,
    position: i % 2 === 0 ? '정방향' : '역방향',
    is_upright: i % 2 === 0,
  })),
};

const MOCK_READ = {
  interpretation: '테스트 해석 결과입니다.',
  cards: [
    { symbol: '🌟', name: '카드1', position: '정방향' },
    { symbol: '🌟', name: '카드2', position: '역방향' },
    { symbol: '🌟', name: '카드3', position: '정방향' },
  ],
};

// Service Worker intercepts GET /api/* requests and makes its own internal
// fetch() that bypasses Playwright's page.route(). Disable SW registration
// so that page.route() mocks are honored during tests.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: () => Promise.reject(new Error('SW disabled in test')) },
      configurable: true,
    });
  });
});

test.describe('ZEMA-3013: tarot 프론트엔드 에러 detail 표시', () => {
  test('셔플 에러: detail 메시지가 토스트에 표시된다', async ({ page }) => {
    const customDetail = '커스텀 셔플 에러 메시지 🔧';
    await page.route(/\/api\/tarot\/shuffle/, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: customDetail }),
      }),
    );

    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();

    await expect(page.locator('#toast')).toHaveText(customDetail, { timeout: 5000 });
    // 에러 후 질문 단계로 복귀
    await expect(page.locator('#step-question')).toBeVisible({ timeout: 5000 });
  });

  test('해석 에러: detail 메시지가 result-text에 표시된다', async ({ page }) => {
    const customDetail = 'AI 해석에 실패했어요. 잠시 후 다시 시도해주세요.';
    await page.route(/\/api\/tarot\/shuffle/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SHUFFLE) }),
    );
    await page.route(/\/api\/tarot\/read/, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: customDetail }),
      }),
    );

    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 5000 });

    const cards = page.locator('#card-area .tarot-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();
    await page.locator('#btn-read').click();

    await expect(page.locator('#result-text')).toHaveText(customDetail, { timeout: 5000 });
  });

  test('채팅 에러: detail 메시지가 채팅 버블에 표시된다', async ({ page }) => {
    const customDetail = 'AI 응답에 실패했어요. 잠시 후 다시 시도해주세요.';
    await page.route(/\/api\/tarot\/shuffle/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SHUFFLE) }),
    );
    await page.route(/\/api\/tarot\/read/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_READ) }),
    );
    await page.route(/\/api\/tarot\/chat/, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: customDetail }),
      }),
    );

    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 5000 });

    const cards = page.locator('#card-area .tarot-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();
    await page.locator('#btn-read').click();
    await expect(page.locator('#result-text')).toHaveText('테스트 해석 결과입니다.', { timeout: 5000 });

    await page.locator('#chat-input').fill('추가 질문입니다.');
    await page.locator('button', { hasText: '전송' }).click();

    await expect(page.locator('.chat-bubble.assistant').last()).toHaveText(customDetail, { timeout: 5000 });
  });

  test('fallback: JSON 본문이 없으면 기본 메시지 표시', async ({ page }) => {
    const defaultMessage = '해석을 불러오지 못했어요 😿 다시 시도해주세요.';
    await page.route(/\/api\/tarot\/shuffle/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SHUFFLE) }),
    );
    await page.route(/\/api\/tarot\/read/, (route) =>
      route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' }),
    );

    await page.goto('/tarot');
    await page.locator('.cat-btn').first().click();
    await page.locator('button', { hasText: '카드 뽑기' }).click();
    await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 5000 });

    const cards = page.locator('#card-area .tarot-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();
    await page.locator('#btn-read').click();

    await expect(page.locator('#result-text')).toHaveText(defaultMessage, { timeout: 5000 });
  });
});
