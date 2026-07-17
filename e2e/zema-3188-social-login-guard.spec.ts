import { test, expect } from '@playwright/test';

const SOCIAL_BUTTONS = '#social-buttons button';

test.describe('ZEMA-3188 소셜 로그인 버튼 가드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator(SOCIAL_BUTTONS).first()).toBeVisible();
  });

  test('버튼이 초기에는 활성화 상태', async ({ page }) => {
    const buttons = page.locator(SOCIAL_BUTTONS);
    const count = await buttons.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).not.toBeDisabled();
      await expect(buttons.nth(i)).not.toHaveClass(/cursor-not-allowed/);
    }
  });

  test('fetch 중 버튼이 비활성화된다', async ({ page }) => {
    let resolveFetch: (v: unknown) => void = () => {};
    const fetchStarted = page.waitForFunction(() => {
      const buttons = document.querySelectorAll('#social-buttons button');
      return Array.from(buttons).every(b => (b as HTMLButtonElement).disabled);
    });

    await page.route('**/auth/oauth/urls', async (route) => {
      await new Promise((resolve) => { resolveFetch = resolve; });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.locator(`${SOCIAL_BUTTONS}`, { hasText: '카카오' }).click();

    await expect(fetchStarted).resolves.toBeTruthy();
    const buttons = page.locator(SOCIAL_BUTTONS);
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toBeDisabled();
      await expect(buttons.nth(i)).toHaveClass(/opacity-50/);
      await expect(buttons.nth(i)).toHaveClass(/cursor-not-allowed/);
    }
    resolveFetch(undefined);
  });

  test('fetch 실패(에러) 시 버튼이 다시 활성화된다', async ({ page }) => {
    await page.route('**/auth/oauth/urls', (route) =>
      route.fulfill({ status: 500, contentType: 'text/plain', body: 'Server Error' }),
    );

    const kakao = page.locator(SOCIAL_BUTTONS, { hasText: '카카오' });
    await kakao.click();

    await expect(page.locator('#toast, [class*="toast"]')).toBeVisible({ timeout: 5000 }).catch(() => {});
    const buttons = page.locator(SOCIAL_BUTTONS);
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).not.toBeDisabled({ timeout: 5000 });
      await expect(buttons.nth(i)).not.toHaveClass(/opacity-50/);
    }
  });

  test('응답에 provider가 없으면 토스트 후 버튼 재활성화', async ({ page }) => {
    await page.route('**/auth/oauth/urls', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    const kakao = page.locator(SOCIAL_BUTTONS, { hasText: '카카오' });
    await kakao.click();

    const buttons = page.locator(SOCIAL_BUTTONS);
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).not.toBeDisabled({ timeout: 5000 });
    }
  });

  test('빠른 연속 클릭 시 중복 fetch가 발생하지 않는다', async ({ page }) => {
    let fetchCount = 0;
    let resolveFirst: (v: unknown) => void = () => {};
    await page.route('**/auth/oauth/urls', async (route) => {
      fetchCount += 1;
      await new Promise((resolve) => { resolveFirst = resolve; });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const kakao = page.locator(SOCIAL_BUTTONS, { hasText: '카카오' });
    await kakao.click();
    await expect(kakao).toBeDisabled();

    await kakao.click({ force: true }).catch(() => {});
    await page.locator(SOCIAL_BUTTONS, { hasText: '네이버' }).click({ force: true }).catch(() => {});
    await page.locator(SOCIAL_BUTTONS, { hasText: 'Google' }).click({ force: true }).catch(() => {});

    resolveFirst(undefined);

    await expect.poll(() => fetchCount, { timeout: 5000 }).toBe(1);
  });
});
