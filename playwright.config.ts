import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, retries: process.env.CI ? 1 : 0, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173/chinese/', trace: 'retain-on-failure', screenshot: 'only-on-failure', serviceWorkers: 'allow' },
  projects: [{name:'mobile-chromium',use:{...devices['iPhone 13'],defaultBrowserType:'chromium',browserName:'chromium'}}, {name:'mobile-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}}],
  webServer: {command:'npm run preview -- --port 4173 --base /chinese/',url:'http://127.0.0.1:4173/chinese/',reuseExistingServer:!process.env.CI}
});
