const SYNC_URL = 'http://127.0.0.1:8080/rules';
const RESOURCE_TYPES = ['script', 'image', 'sub_frame', 'xmlhttprequest', 'ping', 'main_frame', 'other'];

function crc32(str) {
  let c = ~0;
  for (let i = 0; i < str.length; i++) {
    c ^= str.charCodeAt(i);
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c >>> 0) & 0x7fffffff || 1;
}

async function serverDomains() {
  try {
    const res = await fetch(SYNC_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.domains || []);
  } catch (e) {
    console.warn('[iklan-aman] sync failed, static rules still active:', e.message);
    return [];
  }
}

async function allDomains() {
  const { extra = [] } = await chrome.storage.local.get('extra');
  const server = await serverDomains();
  const seen = new Set();
  for (const d of [...extra, ...server]) {
    const dom = String(d).trim().toLowerCase();
    if (dom) seen.add(dom);
  }
  return [...seen];
}

async function applyRules(domains) {
  const rules = [];
  for (const dom of domains) {
    rules.push({
      id: crc32(dom),
      priority: 2,
      action: { type: 'block' },
      condition: { urlFilter: '||' + dom, resourceTypes: RESOURCE_TYPES },
    });
  }
  const prev = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: prev.map((r) => r.id),
    addRules: rules,
  });
  await chrome.storage.local.set({
    sync: { at: Date.now(), count: rules.length },
    domains: domains,
  });
  console.log(`[iklan-aman] synced ${rules.length} domains`);
}

async function sync() {
  const domains = await allDomains();
  const { enabled = true } = await chrome.storage.local.get('enabled');
  if (enabled) await applyRules(domains);
  else await chrome.storage.local.set({ domains });
}

async function setEnabled(on) {
  const rulesetIds = on ? [] : ['blocklist'];
  await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: rulesetIds });
  const prev = await chrome.declarativeNetRequest.getDynamicRules();
  if (!on && prev.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: prev.map((r) => r.id),
    });
  } else if (on) {
    sync();
  }
  console.log('[iklan-aman] ' + (on ? 'active' : 'off'));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'addDomain') {
    (async () => {
      const d = String(msg.domain || '').trim().toLowerCase();
      if (!d) return sendResponse({ ok: false });
      const { extra = [] } = await chrome.storage.local.get('extra');
      if (extra.includes(d)) return sendResponse({ ok: true, dup: true });
      const next = [...extra, d];
      await chrome.storage.local.set({ extra: next });
      await sync();
      sendResponse({ ok: true });
    })();
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  sync();
  chrome.storage.local.get({ enabled: true }, ({ enabled }) => setEnabled(enabled));
});
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
    sync();
    setEnabled(enabled);
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'enabled' in changes) setEnabled(changes.enabled.newValue);
});
chrome.alarms.create('sync', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'sync') sync();
});

// Lapis terakhir: tab hasil popunder (opener ada) yang navigasi ke host asing → tutup.
// Content script gak bisa cegah `w.location = external` (cross-origin).
function sameSiteOf(a, b) {
  if (!a || !b) return false;
  const ha = a.toLowerCase(), hb = b.toLowerCase();
  return ha === hb || ha.endsWith('.' + hb) || hb.endsWith('.' + ha);
}

function isExternalPopup(url, openerUrl) {
  if (!/^https?:/.test(url) || !/^https?:/.test(openerUrl)) return false;
  let u, o;
  try { u = new URL(url); o = new URL(openerUrl); } catch (_) { return false; }
  return !sameSiteOf(u.hostname, o.hostname);
}

async function isEnabled() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  return enabled;
}

// URL hasil klik asli user (bukan popunder). Simpan di storage.session biar
// kebaca deterministik dari tabs.onCreated/onUpdated (bukan var memory yang bisa race).
const USERNAV_MS = 3500;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'usernav') {
    chrome.storage.session.set({ userNav: { url: msg.url, at: Date.now() } }).catch(() => {});
  }
});
async function isUserNav(url) {
  const { userNav } = await chrome.storage.session.get('userNav');
  return userNav && userNav.url === url && Date.now() - userNav.at < USERNAV_MS;
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!(await isEnabled())) return;
  // window.open(external) langsung → tab created dengan url external.
  if (!tab.openerTabId || !tab.url) return;
  if (await isUserNav(tab.url)) return; // klik asli user → jangan tutup
  chrome.tabs.get(tab.openerTabId, (opener) => {
    if (chrome.runtime.lastError || !opener || !opener.url) return;
    if (isExternalPopup(tab.url, opener.url)) {
      console.log('[iklan-aman] closed new popunder:', tab.url.slice(0, 100));
      chrome.tabs.remove(tab.id);
    }
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!(await isEnabled())) return;
  if (!changeInfo.url || !tab.openerTabId) return;
  const url = changeInfo.url;
  if (/^chrome-error:\/\//.test(url)) {
    // Tab popunder yang navigasinya diblokir DNR → mati sisa (chrome-error) → tutup.
    if (await isUserNav(url)) return; // klik user ke situs yang gagal → biarin (error page user)
    chrome.tabs.remove(tabId);
    return;
  }
  if (await isUserNav(url)) return; // klik asli user → jangan tutup
  chrome.tabs.get(tab.openerTabId, (opener) => {
    if (chrome.runtime.lastError || !opener || !opener.url) return;
    if (isExternalPopup(url, opener.url)) {
      console.log('[iklan-aman] closed popunder tab:', url.slice(0, 100));
      chrome.tabs.remove(tabId);
    }
  });
});