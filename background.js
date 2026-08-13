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

// Lapis terakhir: tutup tab popunder. PRINSIP: JANGAN pernah close tab hasil klik
// user ke host asing (itu navigasi sah). Hanya close kalau URL host benar-benar
// ada di daftar blokir (extra + server) / chrome-error hasil DNR block, dan
// tidak ada aktivitas klik user dalam beberapa detik terakhir.
function isBlockedHostName(host) {
  const h = host.toLowerCase();
  const staticHosts = [
    'doubleclick.net', 'googlesyndication.com', 'adnxs.com', 'taboola.com',
    'outbrain.com', 'rm358.com', 'signamentswithd.com', 'pgslot88semarang.com',
    'supechcopa.com', 'poodleshocuses.cyou', 'junclikrmedi.com', 'crmared.com',
    'crmrc.livejasmin.com', 'pncloudfl.com', 'detoxifylagoonsnugness.com',
    '21wiz.com', 'ero-labs.art', 'comanicilikeiste.com', 'brazzersnetwork.com',
  ];
  return (
    staticHosts.includes(h) ||
    staticHosts.some((d) => h.endsWith('.' + d))
  );
}

async function isBlockedUrlBg(url) {
  if (!/^https?:/.test(url)) return false;
  let u;
  try { u = new URL(url); } catch (_) { return false; }
  if (isBlockedHostName(u.hostname)) return true;
  const { domains = [] } = await chrome.storage.local.get('domains');
  const h = u.hostname.toLowerCase();
  return domains.some((d) => h === String(d).toLowerCase() || h.endsWith('.' + d));
}

async function isEnabled() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  return enabled;
}

// Aktivitas klik asli user. Simpan di storage.session (deterministik antar event).
const USERNAV_MS = 4000;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'usernav') {
    chrome.storage.session.set({ userNav: { at: Date.now() } }).catch(() => {});
  }
});
async function recentUserNav() {
  const { userNav } = await chrome.storage.session.get('userNav');
  return userNav && Date.now() - userNav.at < USERNAV_MS;
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!(await isEnabled())) return;
  if (!tab.openerTabId || !tab.url) return;
  // Hanya tutup kalau URL host di daftar blokir → pasti popunder/ad, bukan klik user.
  if (await isBlockedUrlBg(tab.url)) {
    console.log('[iklan-aman] closed new popunder:', tab.url.slice(0, 100));
    chrome.tabs.remove(tab.id);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!(await isEnabled())) return;
  if (!changeInfo.url || !tab.openerTabId) return;
  const url = changeInfo.url;
  if (/^chrome-error:\/\//.test(url)) {
    // chrome-error = navigasi diblokir (DNR). Tapi kalau user baru klik apa pun,
    // jangan sentuh (bisa jadi situs yang dia buka memang error/gagal).
    if (await recentUserNav()) return;
    chrome.tabs.remove(tabId);
    return;
  }
  // Hanya tutup kalau host benar-benar di daftar blokir.
  if (await isBlockedUrlBg(url)) {
    console.log('[iklan-aman] closed popunder tab:', url.slice(0, 100));
    chrome.tabs.remove(tabId);
  }
});