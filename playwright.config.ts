import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    actionTimeout: 8000,
    // app.js는 SW 활성화(clients.claim → controllerchange) 시 일회성 리로드를
    // 수행한다. SW를 다루지 않는 스펙에서 이 리로드가 문서를 교체해 플레이크를
    // 유발하므로 기본적으로 차단하고, SW 검증이 필요한 pwa.spec에서만 허용한다.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
