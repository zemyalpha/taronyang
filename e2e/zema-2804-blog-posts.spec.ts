import { test, expect } from '@playwright/test';

const BASE = process.env.QA_BASE_URL || 'http://localhost:9100/taronyang';

const NEW_POSTS = [
  {
    slug: 'single-fortune-tarot',
    title: '솔로운 타로',
    emoji: '💝',
  },
  {
    slug: 'tarot-rules-and-precautions',
    title: '타로 금기·주의사항',
    emoji: '⚠️',
  },
  {
    slug: 'health-fortune-tarot',
    title: '건강운 타로',
    emoji: '🩺',
  },
  {
    slug: 'tarot-deck-guide',
    title: '타로 덱 종류·추천',
    emoji: '🎴',
  },
  {
    slug: 'how-to-master-tarot',
    title: '타로 마스터 되는 법',
    emoji: '🎓',
  },
];

const CANONICAL_BASE = 'https://zemyalpha.github.io/taronyang';

test.describe('ZEMA-2804 — 블로그 포스트 5종(2차) E2E 검증', () => {

  test.describe('1. 블로그 인덱스 — 5개 신규 카드 + 링크', () => {
    test('블로그 인덱스 로드 및 5개 신규 카드 존재', async ({ page }) => {
      await page.goto(`${BASE}/blog/`, { waitUntil: 'domcontentloaded' });
      expect(page.url()).toContain('/blog/');

      for (const post of NEW_POSTS) {
        const card = page.locator(`a.blog-index-card[href*="${post.slug}"]`);
        await expect(card).toBeVisible();
        await expect(card).toHaveAttribute('href', `/taronyang/blog/${post.slug}.html`);
      }
    });

    test('각 카드에 제목과 설명 텍스트 포함', async ({ page }) => {
      await page.goto(`${BASE}/blog/`, { waitUntil: 'domcontentloaded' });

      for (const post of NEW_POSTS) {
        const card = page.locator(`a.blog-index-card[href*="${post.slug}"]`);
        const title = await card.locator('.blog-index-title').textContent();
        expect(title).toBeTruthy();
        expect(title!.length).toBeGreaterThan(5);

        const desc = await card.locator('.blog-index-desc').textContent();
        expect(desc).toBeTruthy();
        expect(desc!.length).toBeGreaterThan(10);
      }
    });

    test('카드 클릭 → 해당 포스트로 이동', async ({ page }) => {
      await page.goto(`${BASE}/blog/`, { waitUntil: 'domcontentloaded' });

      const firstPost = NEW_POSTS[0];
      await page.locator(`a.blog-index-card[href*="${firstPost.slug}"]`).click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain(`/blog/${firstPost.slug}.html`);
    });
  });

  test.describe('2. 각 포스트 HTML 정상 렌더링', () => {
    for (const post of NEW_POSTS) {
      test(`${post.slug} — 페이지 로드 200 + 본문 표시`, async ({ page }) => {
        const response = await page.goto(`${BASE}/blog/${post.slug}.html`, {
          waitUntil: 'domcontentloaded',
        });
        expect(response?.status()).toBe(200);

        const h1 = await page.locator('article h1').first().textContent();
        expect(h1).toBeTruthy();
        expect(h1!.length).toBeGreaterThan(3);
      });

      test(`${post.slug} — CSS 스타일시트 로드`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'networkidle' });

        const cssLink = page.locator('link[rel="stylesheet"][href*="style.css"]');
        await expect(cssLink).toHaveCount(1);

        const href = await cssLink.getAttribute('href');
        const cssResponse = await page.goto(href!.startsWith('http') ? href! : `${BASE.replace('/taronyang', '')}${href!}`);
        expect(cssResponse?.status()).toBe(200);
      });

      test(`${post.slug} — 블로그 본문 섹션 존재`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const sections = page.locator('article section, .blog-article section');
        const count = await sections.count();
        expect(count).toBeGreaterThanOrEqual(3);
      });

      test(`${post.slug} — 헤더(홈 링크) 및 푸터 존재`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const header = page.locator('header.header');
        await expect(header).toBeVisible();

        const footer = page.locator('footer.footer');
        await expect(footer).toBeVisible();
      });
    }
  });

  test.describe('3. 내부 링크 작동 확인', () => {
    for (const post of NEW_POSTS) {
      test(`${post.slug} — 헤더 홈 링크 → /`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const homeLink = page.locator('header.header a.header-logo');
        await expect(homeLink).toHaveAttribute('href', /\/(taronyang\/)?$/);
      });

      test(`${post.slug} — 헤더 블로그 링크 → /blog/`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const blogLink = page.locator('header.header a.header-login');
        await expect(blogLink).toHaveAttribute('href', /\/(taronyang\/)?blog\/?$/);
      });

      test(`${post.slug} — CTA 버튼 존재 및 내부 링크`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const cta = page.locator('a.cta-button');
        await expect(cta).toBeVisible();
        await expect(cta).toHaveAttribute('href', /\/(taronyang\/)?(tarot|daily)(\?cat=\w+)?\/?$/);
      });

      test(`${post.slug} — 푸터 내부 링크 존재`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const footerLinks = page.locator('footer.footer a');
        const count = await footerLinks.count();
        expect(count).toBeGreaterThanOrEqual(3);
      });

      test(`${post.slug} — 블로그 내부 링크 실제 로드 가능`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const internalLinks = await page.locator('article a[href*="/blog/"]').evaluateAll(els =>
          els.map(e => e.getAttribute('href')).filter(Boolean).slice(0, 3)
        );

        for (const link of internalLinks) {
          const url = link!.startsWith('http') ? link! : `${BASE.replace('/taronyang', '')}${link!}`;
          const response = await page.request.get(url);
          expect(response.status(), `Link ${link} should return 200`).toBe(200);
        }
      });

      test(`${post.slug} — 카드 의미 페이지 링크 로드 가능`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const cardLinks = await page.locator('article a[href*="/cards/"]').evaluateAll(els =>
          els.map(e => e.getAttribute('href')).filter(Boolean).slice(0, 2)
        );

        for (const link of cardLinks) {
          const url = link!.startsWith('http') ? link! : `${BASE.replace('/taronyang', '')}${link!}`;
          const response = await page.request.get(url);
          expect(response.status(), `Card link ${link} should return 200`).toBe(200);
        }
      });
    }
  });

  test.describe('4. canonical URL 검증', () => {
    for (const post of NEW_POSTS) {
      test(`${post.slug} — canonical URL 올바름`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical).toBe(`${CANONICAL_BASE}/blog/${post.slug}.html`);
      });

      test(`${post.slug} — OG URL 일치`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
        expect(ogUrl).toBe(`${CANONICAL_BASE}/blog/${post.slug}.html`);
      });
    }
  });

  test.describe('5. sitemap.xml — 5개 URL 포함', () => {
    test('sitemap.xml 로드 및 5개 신규 URL 포함', async ({ page }) => {
      const response = await page.goto(`${BASE}/sitemap.xml`, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      const content = await page.content();
      for (const post of NEW_POSTS) {
        const url = `${CANONICAL_BASE}/blog/${post.slug}.html`;
        expect(content, `sitemap should contain ${url}`).toContain(url);
      }
    });
  });

  test.describe('6. 모바일 반응형 레이아웃', () => {
    for (const post of NEW_POSTS) {
      test(`${post.slug} — 모바일(375px) 레이아웃 정상`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: 375, height: 812 },
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        });
        const page = await context.newPage();

        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'networkidle' });

        const bodyWidth = await page.locator('body').boundingBox();
        expect(bodyWidth).toBeTruthy();
        expect(bodyWidth!.width).toBeLessThanOrEqual(375);

        const h1Visible = await page.locator('article h1').first().isVisible();
        expect(h1Visible).toBeTruthy();

        const ctaVisible = await page.locator('a.cta-button').isVisible();
        expect(ctaVisible).toBeTruthy();

        await context.close();
      });

      test(`${post.slug} — 태블릿(768px) 레이아웃 정상`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: 768, height: 1024 },
        });
        const page = await context.newPage();

        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const h1Visible = await page.locator('article h1').first().isVisible();
        expect(h1Visible).toBeTruthy();

        await context.close();
      });
    }
  });

  test.describe('7. JSON-LD 구조화 데이터 유효성', () => {
    for (const post of NEW_POSTS) {
      test(`${post.slug} — Article JSON-LD 존재 및 필수 필드`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const ldJsonScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
        expect(ldJsonScripts.length).toBeGreaterThanOrEqual(2);

        const articleData = ldJsonScripts.find(s => s.includes('"@type": "Article"') || s.includes('"@type":"Article"'));
        expect(articleData, 'Article JSON-LD should exist').toBeTruthy();

        const parsed = JSON.parse(articleData!);
        expect(parsed['@type']).toBe('Article');
        expect(parsed.headline).toBeTruthy();
        expect(parsed.description).toBeTruthy();
        expect(parsed.url).toBe(`${CANONICAL_BASE}/blog/${post.slug}.html`);
        expect(parsed.author).toBeTruthy();
        expect(parsed.publisher).toBeTruthy();
        expect(parsed.datePublished).toBeTruthy();
        expect(parsed.inLanguage).toBe('ko-KR');
      });

      test(`${post.slug} — BreadcrumbList JSON-LD 존재 및 구조`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const ldJsonScripts = await page.locator('script[type="application/ld+json"]').allTextContents();

        const breadcrumbData = ldJsonScripts.find(s => s.includes('"@type": "BreadcrumbList"') || s.includes('"@type":"BreadcrumbList"'));
        expect(breadcrumbData, 'BreadcrumbList JSON-LD should exist').toBeTruthy();

        const parsed = JSON.parse(breadcrumbData!);
        expect(parsed['@type']).toBe('BreadcrumbList');
        expect(parsed.itemListElement.length).toBe(3);

        expect(parsed.itemListElement[0].name).toBe('홈');
        expect(parsed.itemListElement[0].position).toBe(1);
        expect(parsed.itemListElement[1].name).toBe('블로그');
        expect(parsed.itemListElement[1].position).toBe(2);
        expect(parsed.itemListElement[2].position).toBe(3);
      });
    }
  });

  test.describe('8. 추가 SEO 메타 태그', () => {
    for (const post of NEW_POSTS) {
      test(`${post.slug} — 필수 메타 태그 존재`, async ({ page }) => {
        await page.goto(`${BASE}/blog/${post.slug}.html`, { waitUntil: 'domcontentloaded' });

        const desc = await page.locator('meta[name="description"]').getAttribute('content');
        expect(desc).toBeTruthy();
        expect(desc!.length).toBeGreaterThan(20);

        const keywords = await page.locator('meta[name="keywords"]').getAttribute('content');
        expect(keywords).toBeTruthy();

        const robots = await page.locator('meta[name="robots"]').getAttribute('content');
        expect(robots).toBe('index, follow');

        const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
        expect(ogType).toBe('article');

        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        expect(ogTitle).toBeTruthy();

        const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
        expect(ogImage).toContain('og-image.png');

        const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
        expect(twitterCard).toBe('summary_large_image');
      });
    }
  });
});
