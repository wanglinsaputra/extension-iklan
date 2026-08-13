// @ts-check
const { defineConfig } = require('@playwright/test');

const fs = require('fs');
const localChromium = () => {
  const home = `${process.env.HOME}/.cache/ms-playwright`;
  if (!fs.existsSync(home)) return undefined;
  const dirs = fs.readdirSync(home).filter((d) => d.startsWith('chromium-'));
  for (const d of dirs.sort().reverse()) {
    const p = `${home}/${d}/chrome-linux64/chrome`;
    if (fs.existsSync(p)) return p;
  }
  return undefined;
};
const CHROME = process.env.PW_CHROMIUM || localChromium();

module.exports = defineConfig({
  testDir: './test',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    headless: true,
    // Extension MV3 butuh Chromium murni (branded Chrome blok --load-extension).
    // executablePath optional: CI pakai bawaan playwright (match versi @playwright/test).
    launchOptions: {
      executablePath: CHROME,
      args: [
        '--disable-extensions-except=.',
        '--load-extension=.',
        '--no-first-run',
      ],
    },
  },
webServer: [
    {
      command: 'python3 server/serve.py',
      port: 8080,
      reuseExistingServer: true,
      timeout: 10000,
    },
    {
      command: 'python3 -m http.server 8090 --directory test',
      port: 8090,
      reuseExistingServer: true,
      timeout: 10000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        executablePath: CHROME,
      },
    },
  ],
});