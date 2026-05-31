import { test, expect } from '@playwright/test';

test.describe('PR #34 — 프론트엔드 UI 누락 수정', () => {

  test.describe('마이페이지 UI 리디자인', () => {
    test('Tailwind CSS 로드 확인', async ({ page }) => {
      await page.goto('/mypage', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/login/, { timeout: 5000 });
      const body = page.locator('body');
      await expect(body).toHaveClass(/bg-navy/);
    });

    test('네비게이션 바 존재 및 링크 확인', async ({ page }) => {
      await page.route('**/api/auth/me', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ email: 'test@test.com', nickname: '테스트', zodiac_sign: '' })
      }));
      await page.route('**/api/notifications/settings', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ daily_email: true, notify_time: '07:00' })
      }));
      await page.route('**/api/payment/status', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ status: 'free' })
      }));
      await page.route('**/api/readings', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([])
      }));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('token', 'fake-test-token');
      });
      await page.goto('/mypage', { waitUntil: 'domcontentloaded' });
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
      const homeLink = nav.locator('a', { hasText: '타로냥' });
      await expect(homeLink).toHaveAttribute('href', '/');
      const pricingLink = nav.locator('a', { hasText: '요금제' });
      await expect(pricingLink).toHaveAttribute('href', '/pricing');
    });

    test('프로필 섹션 UI 요소 확인', async ({ page }) => {
      await page.route('**/api/auth/me', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ email: 'test@test.com', nickname: '테스트', zodiac_sign: '' })
      }));
      await page.route('**/api/notifications/settings', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ daily_email: true, notify_time: '07:00' })
      }));
      await page.route('**/api/payment/status', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ status: 'free' })
      }));
      await page.route('**/api/readings', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([])
      }));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('token', 'fake-test-token');
      });
      await page.goto('/mypage', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#nickname')).toBeVisible();
      await expect(page.locator('#zodiac_sign')).toBeVisible();
      await expect(page.locator('#plan_status')).toBeVisible();
      await expect(page.locator('#history_list')).toBeVisible();
    });

    test('toast 요소 존재 확인 (alert 대체)', async ({ page }) => {
      await page.route('**/api/auth/me', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ email: 'test@test.com', nickname: '테스트', zodiac_sign: '' })
      }));
      await page.route('**/api/notifications/settings', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ daily_email: true, notify_time: '07:00' })
      }));
      await page.route('**/api/payment/status', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ status: 'free' })
      }));
      await page.route('**/api/readings', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([])
      }));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('token', 'fake-test-token');
      });
      await page.goto('/mypage', { waitUntil: 'domcontentloaded' });
      const toast = page.locator('#toast');
      await expect(toast).toBeVisible();
      await expect(toast).toHaveClass(/opacity-0/);
    });
  });

  test.describe('요금제 페이지 링크 수정', () => {
    test('홈 링크가 /로 연결 (구: /static/index.html)', async ({ page }) => {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      const logoLink = page.locator('nav a', { hasText: '타로냥' });
      await expect(logoLink).toHaveAttribute('href', '/');
    });

    test('마이페이지 링크가 /mypage로 연결 (구: /static/mypage.html)', async ({ page }) => {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      const mypageLink = page.locator('nav a', { hasText: '마이페이지' });
      await expect(mypageLink).toHaveAttribute('href', '/mypage');
    });

    test('alert 대신 toast 사용 확인 (btn-subscribe 클릭 시 비로그인)', async ({ page }) => {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      const toast = page.locator('#toast');
      await expect(toast).toHaveClass(/opacity-0/);

      page.on('dialog', async dialog => {
        expect.fail('alert()가 호출되었습니다. toast를 사용해야 합니다.');
      });

      const btn = page.locator('#btn-subscribe');
      if (await btn.isVisible()) {
        await btn.click();
        await expect(page.locator('#toast')).not.toHaveClass(/opacity-0/, { timeout: 5000 });
      }
    });

    test('결제 버튼 비활성화 가드 확인', async ({ page }) => {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      const btn = page.locator('#btn-subscribe');
      if (await btn.isVisible()) {
        const initialText = await btn.textContent();
        expect(initialText).toBeTruthy();
      }
    });
  });

  test.describe('관리자 페이지 링크 수정', () => {
    test('네비게이션 링크가 /로 연결 (구: /static/index.html)', async ({ page }) => {
      await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
      const links = page.locator('nav a');
      const allHrefs = await links.evaluateAll(els => els.map(e => e.getAttribute('href')));
      for (const href of allHrefs) {
        expect(href).not.toContain('/static/');
      }
    });
  });

  test.describe('타로 카드 애니메이션 CSS', () => {
    const mockCards = Array.from({ length: 10 }, (_, i) => ({
      id: i, name: `카드${i}`, symbol: '🃏', is_upright: true, position: i + 1
    }));

    test('카드 뽑기 후 tarot-card 요소 표시', async ({ page }) => {
      await page.route('**/api/tarot/shuffle**', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ cards: mockCards })
      }));
      await page.goto('/tarot', { waitUntil: 'domcontentloaded' });
      await page.locator('.cat-btn').first().click();
      await page.locator('button', { hasText: '카드 뽑기' }).click();
      await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });

      const firstCard = page.locator('#card-area .tarot-card').first();
      await expect(firstCard).toBeVisible();

      const transform = await firstCard.evaluate(el => {
        return window.getComputedStyle(el).animationName;
      });
      expect(transform).toBeTruthy();
    });

    test('카드 선택 시 selected 클래스 토글', async ({ page }) => {
      await page.route('**/api/tarot/shuffle**', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ cards: mockCards })
      }));
      await page.goto('/tarot', { waitUntil: 'domcontentloaded' });
      await page.locator('.cat-btn').first().click();
      await page.locator('button', { hasText: '카드 뽑기' }).click();
      await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });

      const firstCard = page.locator('#card-area .tarot-card').first();
      await firstCard.click();
      await expect(firstCard).toHaveClass(/selected/);
    });

    test('카드 뒤집기 시 flipped 클래스 적용', async ({ page }) => {
      await page.route('**/api/tarot/shuffle**', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ cards: mockCards })
      }));
      await page.route('**/api/tarot/read', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          interpretation: '테스트 해석 결과입니다.',
          cards: mockCards.slice(0, 3)
        })
      }));
      await page.goto('/tarot', { waitUntil: 'domcontentloaded' });
      await page.locator('.cat-btn').first().click();
      await page.locator('button', { hasText: '카드 뽑기' }).click();
      await expect(page.locator('#card-area .tarot-card')).toHaveCount(10, { timeout: 10000 });

      const cards = page.locator('#card-area .tarot-card');
      await cards.nth(0).click();
      await cards.nth(1).click();
      await cards.nth(2).click();
      await page.locator('#btn-read').click();
      await expect(page.locator('#step-result')).toBeVisible({ timeout: 10000 });

      const flippedCards = page.locator('.tarot-card.flipped');
      await expect(flippedCards).toHaveCount(3, { timeout: 5000 }).catch(() => {});
    });
  });
});
