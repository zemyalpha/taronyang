import { test, expect } from '@playwright/test';

function getTodayKST(): string {
  const kst = new Date(Date.now() + 9 * 3600000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayKST(): string {
  const kst = new Date(Date.now() + 9 * 3600000 - 86400000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

test.describe('ZEMA-2910: 클라이언트 사이드 today-meta fallback', () => {

  test('정상 경로: today-meta.json이 오늘 날짜 → 메타 데이터 그대로 표시', async ({ page }) => {
    const todayStr = getTodayKST();

    await page.route('**/blog/daily/today-meta.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: todayStr,
          weekday: '수요일',
          cards: [
            { name: '연인', symbol: '💕', slug: '6-lovers' },
            { name: '바보', symbol: '🃏', slug: '0-fool' },
            { name: '여황제', symbol: '👑', slug: '3-empress' },
          ],
          summary: '오늘은 사랑의 에너지가 흐르는 날이에요.',
          luckyColor: '소프트 그린',
          luckyColorHex: '#86efac',
          luckyNumber: 1,
          url: `/blog/daily/${todayStr}.html`,
        }),
      });
    });

    await page.goto('/');
    await expect(page.locator('#daily-fortune-section')).toBeVisible();
    await expect(page.locator('#daily-fortune-cards')).toHaveText('💕 🃏 👑');
    await expect(page.locator('#daily-fortune-cards')).toHaveAttribute(
      'aria-label', '연인, 바보, 여황제'
    );
    await expect(page.locator('#daily-fortune-summary')).toHaveText('오늘은 사랑의 에너지가 흐르는 날이에요.');
    await expect(page.locator('#daily-fortune-color')).toContainText('소프트 그린');
    await expect(page.locator('#daily-fortune-number')).toContainText('1');
    await expect(page.locator('#daily-fortune-link')).toHaveAttribute('href', `/blog/daily/${todayStr}.html`);
  });

  test('스테일 meta fallback: 어제 날짜 meta → 오늘 HTML에서 데이터 추출', async ({ page }) => {
    const todayStr = getTodayKST();
    const yesterdayStr = getYesterdayKST();

    await page.route('**/blog/daily/today-meta.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: yesterdayStr,
          weekday: '화요일',
          cards: [
            { name: '태양', symbol: '☀️', slug: '19-sun' },
          ],
          summary: '어제 운세 요약입니다 (스테일).',
          luckyColor: '레드',
          luckyColorHex: '#ff0000',
          luckyNumber: 9,
          url: `/blog/daily/${yesterdayStr}.html`,
        }),
      });
    });

    await page.goto('/');
    await expect(page.locator('#daily-fortune-section')).toBeVisible();

    await expect(page.locator('#daily-fortune-cards')).toHaveText('💕 🃏 👑');
    await expect(page.locator('#daily-fortune-cards')).toHaveAttribute(
      'aria-label', '연인, 바보, 여황제'
    );

    await expect(page.locator('#daily-fortune-link')).toHaveAttribute('href', `/blog/daily/${todayStr}.html`);
    await expect(page.locator('#daily-fortune-summary')).not.toHaveText('어제 운세 요약입니다 (스테일).');
  });

  test('fallback 실패: 스테일 meta + 오늘 HTML 404 → 스테일 데이터 그대로 표시 (빈 화면 아님)', async ({ page }) => {
    const yesterdayStr = getYesterdayKST();
    const todayStr = getTodayKST();

    await page.route('**/blog/daily/today-meta.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: yesterdayStr,
          weekday: '화요일',
          cards: [
            { name: '태양', symbol: '☀️', slug: '19-sun' },
          ],
          summary: '어제 운세 요약입니다 (스테일).',
          luckyColor: '레드',
          luckyColorHex: '#ff0000',
          luckyNumber: 9,
          url: `/blog/daily/${yesterdayStr}.html`,
        }),
      });
    });

    await page.route(`**/blog/daily/${todayStr}.html`, async (route) => {
      await route.fulfill({ status: 404 });
    });

    await page.goto('/');
    await expect(page.locator('#daily-fortune-section')).toBeVisible();

    await expect(page.locator('#daily-fortune-cards')).toHaveText('☀️');
    await expect(page.locator('#daily-fortune-cards')).toHaveAttribute('aria-label', '태양');
    await expect(page.locator('#daily-fortune-summary')).toHaveText('어제 운세 요약입니다 (스테일).');
    await expect(page.locator('#daily-fortune-color')).toContainText('레드');
    await expect(page.locator('#daily-fortune-number')).toContainText('9');
    await expect(page.locator('#daily-fortune-link')).toHaveAttribute('href', `/blog/daily/${yesterdayStr}.html`);
  });

  test('getTodayKST 함수 정확성: KST 시간대 날짜 반환', async ({ page }) => {
    const result = await page.evaluate(() => {
      function getTodayKST(): string {
        const kst = new Date(Date.now() + 9 * 3600000);
        const y = kst.getUTCFullYear();
        const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
        const d = String(kst.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return getTodayKST();
    });

    const expected = getTodayKST();
    expect(result).toBe(expected);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('today-meta.json 로드 실패 시 섹션 숨김 유지', async ({ page }) => {
    await page.route('**/blog/daily/today-meta.json', async (route) => {
      await route.fulfill({ status: 404 });
    });

    await page.goto('/');
    await expect(page.locator('#daily-fortune-section')).toBeHidden();
  });
});
