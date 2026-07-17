import { test, expect } from '@playwright/test';

test.describe('ZEMA-3180: 로그인/회원가입 submit guard + 비밀번호 검증', () => {
  test('비밀번호 입력창에 올바른 길이 제한 속성이 있다', async ({ page }) => {
    await page.goto('/login');

    const loginPwd = page.locator('#login-password');
    await expect(loginPwd).toHaveAttribute('maxlength', '128');

    await page.locator('#tab-signup').click();
    const signupPwd = page.locator('#signup-password');
    await expect(signupPwd).toHaveAttribute('minlength', '6');
    await expect(signupPwd).toHaveAttribute('maxlength', '128');
  });

  test('로그인: 요청 중 버튼이 비활성화되고 "로그인 중..." 표시 후 실패 시 복구', async ({ page }) => {
    let resolveLogin: (v: unknown) => void;
    const loginRequest = new Promise((resolve) => { resolveLogin = resolve; });

    await page.route('**/api/auth/login', async (route) => {
      await loginRequest;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: '이메일 또는 비밀번호가 올바르지 않습니다.' }),
      });
    });

    await page.goto('/login');
    const btn = page.locator('#form-login button[type="submit"]');

    await page.locator('#login-email').fill('user@test.com');
    await page.locator('#login-password').fill('password123');
    await btn.click();

    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('로그인 중...');

    resolveLogin!(undefined);

    await expect(btn).toBeEnabled({ timeout: 5000 });
    await expect(btn).toHaveText('로그인');
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText('이메일 또는 비밀번호');
  });

  test('회원가입: 요청 중 버튼이 비활성화되고 "가입 중..." 표시 후 실패 시 복구', async ({ page }) => {
    let resolveSignup: (v: unknown) => void;
    const signupRequest = new Promise((resolve) => { resolveSignup = resolve; });

    await page.route('**/api/auth/signup', async (route) => {
      await signupRequest;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ detail: '이미 가입된 이메일입니다.' }),
      });
    });

    await page.goto('/login');
    await page.locator('#tab-signup').click();
    const btn = page.locator('#form-signup button[type="submit"]');

    await page.locator('#signup-email').fill('dup@test.com');
    await page.locator('#signup-password').fill('password123');
    await btn.click();

    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('가입 중...');

    resolveSignup!(undefined);

    await expect(btn).toBeEnabled({ timeout: 5000 });
    await expect(btn).toHaveText('회원가입');
    await expect(page.locator('#signup-error')).toBeVisible();
    await expect(page.locator('#signup-error')).toContainText('이미 가입된 이메일');
  });

  test('HTML5 검증: 회원가입 폼에서 5자리 비밀번호는 유효하지 않다', async ({ page }) => {
    let requestHappened = false;
    await page.route('**/api/auth/signup', async (route) => {
      requestHappened = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/login');
    await page.locator('#tab-signup').click();
    const btn = page.locator('#form-signup button[type="submit"]');

    await page.locator('#signup-email').fill('user@test.com');
    await page.locator('#signup-password').fill('12345');
    await btn.click();

    const isValid = await page.locator('#form-signup').evaluate(
      (form: HTMLFormElement) => form.checkValidity(),
    );
    expect(isValid).toBe(false);
    expect(requestHappened).toBe(false);
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('회원가입');
  });
});
