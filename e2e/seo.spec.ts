import { test, expect } from '@playwright/test';

test.describe('SEO 최적화 (ZEMA-2573)', () => {

  test.describe('홈페이지 메타 태그', () => {
    test('필수 SEO 메타 태그 존재', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const keywords = await page.locator('meta[name="keywords"]').getAttribute('content');
      expect(keywords).toBeTruthy();
      expect(keywords!).toContain('무료 타로');
      expect(keywords!).toContain('AI 타로');

      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots).toBe('index, follow');

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe('https://taronyang.com/');

      const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
      expect(twitterCard).toBe('summary_large_image');

      const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
      expect(ogType).toBe('website');

      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toContain('무료 AI 타로');

      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(desc).toContain('무료 AI 타로');

      await expect(page).toHaveTitle(/무료 AI 타로/);
    });

    test('네비게이션 링크 — 클린 URL', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('a.header-logo')).toHaveAttribute('href', '/');
      await expect(page.locator('a.header-login')).toHaveAttribute('href', '/login');
      await expect(page.locator('a.cta-button')).toHaveAttribute('href', '/tarot');
    });

    test('카테고리 카드 딥링크 — ?cat= URL', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const catLinks = page.locator('.category-card');
      await expect(catLinks).toHaveCount(6);

      const hrefs = await catLinks.evaluateAll(els =>
        els.map(e => e.getAttribute('href'))
      );
      expect(hrefs).toContain('/tarot?cat=love');
      expect(hrefs).toContain('/tarot?cat=money');
      expect(hrefs).toContain('/tarot?cat=career');
      expect(hrefs).toContain('/tarot?cat=general');
      expect(hrefs).toContain('/tarot?cat=newyear');
      expect(hrefs).toContain('/tarot?cat=compatibility');
    });
  });

  test.describe('타로 페이지 딥링크 (?cat=)', () => {
    // category는 script-scoped let 변수라 window에서 접근 불가.
    // step 전환(#step-question 가시성)으로 딥링크 동작을 검증한다.

    test('cat=love → 질문 단계 자동 전환 + 연애운 버튼 하이라이트', async ({ page }) => {
      await page.goto('/tarot?cat=love', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-question')).toBeVisible();
      await expect(page.locator('#step-category')).toHaveClass(/hidden/);
      const loveBtn = page.locator(".cat-btn[onclick*=\"'love'\"]");
      await expect(loveBtn).toHaveClass(/border-gold/);
    });

    test('cat=money → 질문 단계 자동 전환 + 재물운 버튼 하이라이트', async ({ page }) => {
      await page.goto('/tarot?cat=money', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-question')).toBeVisible();
      const moneyBtn = page.locator(".cat-btn[onclick*=\"'money'\"]");
      await expect(moneyBtn).toHaveClass(/border-gold/);
    });

    test('cat=career → 질문 단계 자동 전환 + 직장운 버튼 하이라이트', async ({ page }) => {
      await page.goto('/tarot?cat=career', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-question')).toBeVisible();
      const careerBtn = page.locator(".cat-btn[onclick*=\"'career'\"]");
      await expect(careerBtn).toHaveClass(/border-gold/);
    });

    test('cat=general → 질문 단계 자동 전환 + 종합운 버튼 하이라이트', async ({ page }) => {
      await page.goto('/tarot?cat=general', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-question')).toBeVisible();
      const generalBtn = page.locator(".cat-btn[onclick*=\"'general'\"]");
      await expect(generalBtn).toHaveClass(/border-gold/);
    });

    test('cat=newyear → 질문 단계 전환 (버튼 없음 — 버그 후보)', async ({ page }) => {
      await page.goto('/tarot?cat=newyear', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-question')).toBeVisible();
    });

    test('cat=compatibility → 질문 단계 전환 (버튼 없음 — 버그 후보)', async ({ page }) => {
      await page.goto('/tarot?cat=compatibility', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-question')).toBeVisible();
    });

    test('잘못된 cat 값 → 카테고리 단계 유지', async ({ page }) => {
      await page.goto('/tarot?cat=invalidxyz', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-category')).toBeVisible();
      await expect(page.locator('#step-question')).toHaveClass(/hidden/);
    });

    test('cat 파라미터 없음 → 카테고리 단계 유지', async ({ page }) => {
      await page.goto('/tarot', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-category')).toBeVisible();
      await expect(page.locator('#step-question')).toHaveClass(/hidden/);
    });

    test('XSS 시도 — 허용 목록에 없는 값은 무시', async ({ page }) => {
      await page.goto('/tarot?cat=%3Cscript%3Ealert(1)%3C%2Fscript%3E', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#step-category')).toBeVisible();
      await expect(page.locator('#step-question')).toHaveClass(/hidden/);
    });
  });

  test.describe('페이지 로딩 회귀 테스트', () => {
    test('모든 주요 페이지 200 로드', async ({ page }) => {
      const routes = ['/', '/tarot', '/daily', '/history', '/mypage', '/login', '/pricing'];
      for (const route of routes) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
      }
    });

    test('CSS 스타일시트 로드', async ({ page }) => {
      const response = await page.goto('/static/css/style.css');
      expect(response?.status()).toBe(200);
    });
  });
});
