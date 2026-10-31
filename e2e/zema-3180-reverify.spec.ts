import { test, expect } from '@playwright/test';

async function submitForm(page: import('@playwright/test').Page, formSelector: string) {
  await page.locator(formSelector).evaluate((form: HTMLFormElement) => {
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true }));
  });
}

test.describe('ZEMA-3180 재검증: 프로덕션 submit guard', () => {
  test('비밀번호 입력창 속성 확인', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });

    const loginPwd = page.locator('#login-password');
    await expect(loginPwd).toHaveAttribute('maxlength', '128');
    const loginMin = await loginPwd.getAttribute('minlength');
    expect(loginMin).toBeNull();

    await page.locator('#tab-signup').click();
    await expect(page.locator('#form-signup')).toBeVisible();
    const signupPwd = page.locator('#signup-password');
    await expect(signupPwd).toHaveAttribute('minlength', '8');
    await expect(signupPwd).toHaveAttribute('maxlength', '128');
  });

  test('로그인: submit 시 버튼 비활성화 + "로그인 중..." 표시', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.locator('#login-email').fill('user@test.com');
    await page.locator('#login-password').fill('password123');

    await submitForm(page, '#form-login');

    const btn = page.locator('#form-login button[type="submit"]');
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('로그인 중...');
  });

  test('회원가입: submit 시 버튼 비활성화 + "가입 중..." 표시', async ({ page }) => {
    let resolveReq: (v: unknown) => void;
    const pending = new Promise((r) => { resolveReq = r; });
    await page.route('**/api/auth/signup', async (route) => {
      await pending;
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: '이미 가입된 이메일입니다.' }) });
    });

    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.locator('#tab-signup').click();
    await expect(page.locator('#form-signup')).toBeVisible();

    await page.locator('#signup-email').fill('dup@test.com');
    await page.locator('#signup-password').fill('password123');

    await submitForm(page, '#form-signup');

    const btn = page.locator('#form-signup button[type="submit"]');
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('가입 중...');

    resolveReq!(undefined);
    await expect(btn).toBeEnabled({ timeout: 5000 });
    await expect(btn).toHaveText('회원가입');
  });

  test('HTML5 검증: 회원가입 7자리 비밀번호는 유효하지 않다', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.locator('#tab-signup').click();
    await expect(page.locator('#form-signup')).toBeVisible();

    await page.locator('#signup-email').fill('user@test.com');
    await page.locator('#signup-password').fill('1234567');

    const isValid = await page.locator('#form-signup').evaluate(
      (form: HTMLFormElement) => form.checkValidity(),
    );
    expect(isValid).toBe(false);
  });
});
