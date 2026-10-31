import { test, expect } from '@playwright/test';

const BLOG_POSTS = [
  'yes-no-tarot',
  'tarot-deck-guide',
  'love-fortune-tarot',
  'tarot-spreads-guide',
  'tarot-card-meanings-guide',
  'major-arcana-guide',
  'minor-arcana-guide',
  'money-fortune-tarot',
  'career-fortune-tarot',
  'health-fortune-tarot',
  'reconciliation-fortune-tarot',
  'single-fortune-tarot',
  'study-exam-fortune-tarot',
  'monthly-weekly-fortune-tarot',
  'zodiac-tarot-compatibility',
  'how-to-read-tarot-beginner',
  'how-to-master-tarot',
  'tarot-card-interpretation-basics',
  'tarot-question-guide',
  'tarot-reverse-meaning',
  'tarot-rules-and-precautions',
  'free-tarot-reading-sites',
  'taro-fortune-guide',
  'daily-tarot-fortune',
];

const CORE_PAGES = [
  '/',
  '/tarot',
  '/daily',
  '/login',
  '/mypage',
  '/pricing',
];

const API_ENDPOINTS = [
  '/api/health',
  '/api/tarot/categories',
  '/api/tarot/shuffle?count=3',
];

test.describe('ZEMA-3455: Blog/FAQ 404 fix — Express static middleware', () => {
  test.describe('1. Blog index', () => {
    test('블로그 인덱스 페이지 로드 + 포스트 카드 존재', async ({ page }) => {
      const response = await page.goto('/blog/', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      await expect(page).toHaveTitle(/블로그|타로냥/);

      const postLinks = page.locator('a[href*="/blog/"]');
      const count = await postLinks.count();
      expect(count).toBeGreaterThanOrEqual(10);
    });
  });

  test.describe('2. Blog posts', () => {
    for (const slug of BLOG_POSTS) {
      test(`${slug}.html — HTTP 200 + 본문 존재`, async ({ page }) => {
        const response = await page.goto(`/blog/${slug}.html`, {
          waitUntil: 'domcontentloaded',
        });
        expect(response?.status()).toBe(200);

        const h1 = await page.locator('article h1, h1').first().textContent();
        expect(h1).toBeTruthy();
        expect(h1!.trim().length).toBeGreaterThan(3);
      });
    }
  });

  test.describe('3. Daily fortune metadata JSON', () => {
    test('today-meta.json — HTTP 200 + 필수 키 존재', async ({ request }) => {
      const response = await request.get('/blog/daily/today-meta.json');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('date');
      expect(body).toHaveProperty('cards');
      expect(body).toHaveProperty('summary');
      expect(body).toHaveProperty('luckyColor');
      expect(body).toHaveProperty('luckyNumber');
    });
  });

  test.describe('4. Homepage daily fortune section', () => {
    test('홈페이지 일일 운세 미리보기 섹션 표시', async ({ page }) => {
      const failedRequests: string[] = [];
      page.on('requestfailed', (req) => {
        if (req.url().includes('today-meta')) {
          failedRequests.push(req.url());
        }
      });

      await page.goto('/', { waitUntil: 'networkidle' });

      const dailySection = page.locator('[id*="daily-fortune"], .daily-fortune');
      await expect(dailySection.first()).toBeVisible();

      expect(failedRequests).toHaveLength(0);
    });
  });

  test.describe('5. FAQ page', () => {
    test('/faq — HTTP 200 + FAQ 콘텐츠 존재', async ({ page }) => {
      const response = await page.goto('/faq', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      await expect(page).toHaveTitle(/FAQ|자주 묻는 질문/);
    });
  });

  test.describe('6. Core pages — no regression', () => {
    for (const route of CORE_PAGES) {
      test(`${route || '/ (root)'} — HTTP 200`, async ({ page }) => {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
      });
    }
  });

  test.describe('7. API endpoints — no regression', () => {
    for (const ep of API_ENDPOINTS) {
      test(`${ep} — HTTP 200`, async ({ request }) => {
        const response = await request.get(ep);
        expect(response.status()).toBe(200);
      });
    }
  });
});
