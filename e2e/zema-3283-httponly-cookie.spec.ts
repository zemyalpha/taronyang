import { test, expect } from '@playwright/test';

test.describe('ZEMA-3283 — JWT HttpOnly Cookie Migration', () => {
  const testPassword = 'testpass1234';

  async function signupAndRedirect(page: any, email: string, nickname: string) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => showTab('signup'));
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill(testPassword);
    await page.locator('#signup-nickname').fill(nickname);
    await page.locator('#form-signup button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });
  }

  test('회원가입 → HttpOnly 쿠키 설정 + XSS 방어 + localStorage 없음', async ({ page, context }) => {
    await signupAndRedirect(page, `qa-cookie1-${Date.now()}@example.com`, 'QA쿠키1');

    const cookies = await context.cookies();
    const tokenCookie = cookies.find(c => c.name === 'token');
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie!.httpOnly).toBe(true);
    expect(tokenCookie!.sameSite).toBe('Strict');

    const exposed = await page.evaluate(() => document.cookie);
    expect(exposed).not.toContain('token');
    expect(exposed).not.toContain('eyJ');

    const tokenInLS = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenInLS).toBeNull();
  });

  test('쿠키 기반 인증 + 마이페이지 로드 (회귀 테스트)', async ({ page }) => {
    const email = `qa-cookie2-${Date.now()}@example.com`;
    await signupAndRedirect(page, email, 'QA쿠키2');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    });
    expect(result.status).toBe(200);
    expect(result.body.email).toBe(email);

    await page.route('**/api/auth/me', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ email, nickname: 'QA쿠키2', zodiac_sign: '' })
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

    await page.goto('/mypage', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#nickname')).toBeVisible();
    await expect(page.locator('#plan_status')).toBeVisible();
  });

  test('로그아웃 → 쿠키 삭제 + 인증 실패', async ({ page, context }) => {
    await signupAndRedirect(page, `qa-cookie3-${Date.now()}@example.com`, 'QA쿠키3');

    expect((await context.cookies()).find(c => c.name === 'token')).toBeDefined();

    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user');
      window.location.href = '/login';
    });
    await page.waitForURL(/\/login/, { timeout: 10000 });

    expect((await context.cookies()).find(c => c.name === 'token')).toBeUndefined();

    const status = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.status;
    });
    expect(status).toBe(401);
  });
});
