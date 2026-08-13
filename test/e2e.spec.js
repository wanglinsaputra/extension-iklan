// @ts-check
const { test: base, expect } = require('@playwright/test');
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const EXT_DIR = path.resolve(__dirname, '..');

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

async function wakeSw(context) {
  let sw = context.serviceWorkers()[0];
  if (sw) return sw;
  const p = await context.newPage();
  await p.goto('http://127.0.0.1:8090/overlay.html');
  await p.waitForTimeout(500);
  sw = context.serviceWorkers()[0];
  await p.close();
  return sw;
}

// Extension MV3 hanya aktif di persistent context (user data dir).
const test = base.extend({
  context: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iklan-'));
    const ctx = await chromium.launchPersistentContext(dir, {
      executablePath: CHROME,
      headless: true,
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
        '--no-first-run',
      ],
    });
    await use(ctx);
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  },
});

test('L0 overlay pass-through', async ({ context, page }) => {
  const sw = context.serviceWorkers()[0];
  await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));
  await page.goto('http://127.0.0.1:8090/overlay.html');
  const btn = await page.locator('#play').boundingBox();
  await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await expect(page.locator('#log')).toContainText('PASS');
});

test('L0 popup guard', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  await page.click('#blocked');
  await expect(page.locator('#log')).toContainText('1 PASS');
  await page.click('#legit');
  await expect(page.locator('#log')).toContainText('2 PASS');
  await page.click('#blank');
  await expect(page.locator('#log')).toContainText('3 PASS');
});

test('popunder: window.open TANPA gesture diblokir', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  // tanpa klik user sebelumnya — auto popunder harus null
  const r = await page.evaluate(() => window.open('https://example.com/'));
  expect(r).toBeNull();
});

test('popup: window.open SETELAH gesture, host same-site jalan', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  await page.click('#blank');
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => window.open('http://127.0.0.1:8090/me.html'));
  expect(r).not.toBeNull();
});

test('popup: window.open host ASING diblokir walau ada gesture', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  await page.click('#blank');
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => window.open('https://okx.com/en-us/download'));
  expect(r).toBeNull();
});

test('anchor: klik link same-site tetap jalan', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  // tambah anchor same-site, klik, harus navigasi
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.id = 'sameSiteLink';
    a.href = '/me.html';
    a.textContent = 'same-site';
    document.body.appendChild(a);
  });
  await page.click('#sameSiteLink');
  await expect(page).toHaveURL(/me\.html$/);
});

test('search-redirect (google?q=judol) diblokir', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  await page.click('#search');
  await expect(page.locator('#log')).toContainText('4 PASS');
});

test('anchor target=_blank ke google?q=judol diblokir', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/popup.html');
  await page.click('#anchor');
  // kalau diblokir, log TIDAK berubah (tetap "Status: belum dites.")
  await page.waitForTimeout(600);
  const log = await page.textContent('#log');
  expect(log).not.toContain('FAIL');
});

test('DNR static block + dynamic sync', async ({ page }) => {
  const blocked = [];
  page.on('requestfailed', (r) => blocked.push(r.url()));

  await page.goto('http://127.0.0.1:8090/dnr.html');
  await expect(page.locator('#log')).toContainText('REJECTED');

  await page.evaluate(() => {
    const s = document.createElement('script');
    s.src = 'https://contoh-judol.example/x.js';
    document.body.appendChild(s);
  });
  await page.waitForTimeout(1000);
  expect(blocked).toContain('https://doubleclick.net/blocked');
  expect(blocked).toContain('https://contoh-judol.example/x.js');
});

test('adblock-wall bypass sets flags', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/overlay.html');
  const flags = await page.evaluate(() => ({
    canRunAds: window.canRunAds,
    fab: typeof window.fuckAdBlock + '/' + typeof window.blockAdBlock,
  }));
  expect(flags.canRunAds).toBe(true);
  expect(flags.fab).toBe('object/object');
});

test('video ad overlay dihapus dari DOM', async ({ page }) => {
  await page.goto('http://127.0.0.1:8090/videoad.html');
  await expect(page.locator('#log')).toContainText('PASS');
  const containerGone = await page.evaluate(() => !!document.getElementById('container'));
  expect(containerGone).toBe(false);
});

test('toggle OFF me-nonaktifkan semua', async ({ context }) => {
  const sw = await wakeSw(context);
  await sw.evaluate(() => chrome.storage.local.set({ enabled: false }));

  const page2 = await context.newPage();
  await page2.goto('http://127.0.0.1:8090/overlay.html');
  await page2.waitForFunction(() => document.documentElement.dataset.iklanAman === 'off');
  const btn = await page2.locator('#play').boundingBox();
  await page2.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await expect(page2.locator('#log')).toContainText('FAIL');
  await page2.close();
});

test('addDomain dari popup bikin rule dinamis + blokir', async ({ context, page }) => {
  const sw = await wakeSw(context);
  // jalan yang sama dengan popup: storage extra + trigger sync
  await sw.evaluate(async () => {
    const { extra = [] } = await chrome.storage.local.get('extra');
    const next = [...extra, 'newpop-test.example'];
    await chrome.storage.local.set({ extra: next });
    // kick ulang rules lewat event toggle (buat SW bangun + sync)
    await chrome.storage.local.set({ enabled: false });
    await chrome.storage.local.set({ enabled: true });
  });
  await page.waitForTimeout(800);

  // dynamic rules harus berisi domain baru
  const state = await sw.evaluate(async () => {
    const rs = await chrome.declarativeNetRequest.getDynamicRules();
    return rs.map((r) => r.condition.urlFilter);
  });
  expect(state).toContain('||newpop-test.example');

  // request ke domain itu harus diblokir
  const blocked = [];
  page.on('requestfailed', (r) => blocked.push(r.url()));
  await page.goto('http://127.0.0.1:8090/dnr.html');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.src = 'https://newpop-test.example/x.js';
    document.body.appendChild(s);
  });
  await page.waitForTimeout(1000);
  expect(blocked).toContain('https://newpop-test.example/x.js');
});