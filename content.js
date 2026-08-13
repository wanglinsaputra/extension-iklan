(() => {
  const AD_Z_INDEX = 9000;
  const SEARCH_HOSTS =
    /^(www\.)?(google\.\w{2,3}(\.[a-z]{2})?|google\.[a-z]{2,3}|bing\.com|duckduckgo\.com|yahoo\.com|search\.yahoo\.com)$/i;

  // static default + dynamic dari server (sync)
  let blockDomains = new Set([
    'doubleclick.net', 'googlesyndication.com', 'adnxs.com',
    'taboola.com', 'outbrain.com', 'rm358.com', 'signamentswithd.com',
    'pgslot88semarang.com', 'supechcopa.com', 'poodleshocuses.cyou',
    'junclikrmedi.com', 'crmared.com', 'crmrc.livejasmin.com',
    'pncloudfl.com', 'detoxifylagoonsnugness.com',
  ]);

  let enabled = document.documentElement.dataset.iklanAman !== 'off';
  window.addEventListener('iklan-aman-toggle', (e) => {
    enabled = !!e.detail.on;
  });

  // Popunder = window.open tanpa user gesture (auto, bukan klik). Track gesture.
  let lastGesture = 0;
  const GESTURE_MS = 1200;
  const markGesture = (e) => {
    if (e.isTrusted) lastGesture = Date.now();
  };
  document.addEventListener('pointerdown', markGesture, true);
  document.addEventListener('mousedown', markGesture, true);
  document.addEventListener('mouseup', markGesture, true);
  document.addEventListener('keydown', markGesture, true);
  const hasGesture = () => Date.now() - lastGesture < GESTURE_MS;

  const dyn = document.documentElement.dataset.iklanAmanDomains;
  if (dyn) {
    try { JSON.parse(dyn).forEach((d) => blockDomains.add(String(d).toLowerCase())); } catch (_) {}
  }
  window.addEventListener('iklan-aman-domains', (e) => {
    blockDomains = new Set([
      'doubleclick.net', 'googlesyndication.com', 'adnxs.com',
      'taboola.com', 'outbrain.com', 'rm358.com', 'signamentswithd.com',
      'pgslot88semarang.com', 'supechcopa.com', 'poodleshocuses.cyou',
      'junclikrmedi.com', 'crmared.com', 'crmrc.livejasmin.com',
      'pncloudfl.com', 'detoxifylagoonsnugness.com',
    ]);
    (e.detail.domains || []).forEach((d) => blockDomains.add(String(d).toLowerCase()));
  });

  const isBlockedHost = (host) =>
    blockDomains.has(host) || [...blockDomains].some((d) => host === d || host.endsWith('.' + d));

  // Redirect judol sering lewat search: google.com/search?q=toto66luck.site-... 
  const isBlockedSearch = (u) => {
    if (!SEARCH_HOSTS.test(u.hostname)) return false;
    const q = (u.searchParams.get('q') || '').toLowerCase();
    if (!q) return false;
    return [...blockDomains].some((d) => q.includes(d));
  };

  const isBlockedUrl = (u) => isBlockedHost(u.hostname) || isBlockedSearch(u);

  // Overlay ad di dalam video player / halaman: badge "Ad", tombol Continue/OK 18+,
  // img dari domain blokir. Hafalkan node dan hapus saat muncul.
  const AD_TEXT = /\b(advertisement|ads?|promoted|sponsored)\b/i;
  const CTA_TEXT = /\b(continue|confirm|ok|allow|play|visit|learn more|yes)\b/i;
  const ADULT_CTX = /\b(18\+|18 plus|adult|confirm|continue)\b/i;

  const hasDescendantText = (el, re, exact) => {
    if (!el || !el.querySelectorAll) return false;
    const hits = el.querySelectorAll('div,span,button,a,strong,p');
    for (let i = 0; i < hits.length; i++) {
      const t = (hits[i].textContent || '').trim();
      if (t && (exact ? t === 'Ad' : re.test(t))) return true;
    }
    return false;
  };

  const removeAdOverlays = () => {
    if (!enabled) return;
    const isFixedAbs = (el) => {
      const p = getComputedStyle(el).position;
      return p === 'fixed' || p === 'absolute';
    };

    const findAdParent = (el) => {
      let cur = el.parentElement;
      let guard = 0;
      while (cur && cur !== document.body && cur !== document.documentElement && guard++ < 8) {
        if (isFixedAbs(cur)) return cur;
        cur = cur.parentElement;
      }
      return el.parentElement;
    };

    const process = (root) => {
      const hostOrDoc = (el) => (el instanceof HTMLIFrameElement ? (el.contentDocument || null) : null);

      // kumpulin semua root termasuk shadow DOM
      const roots = [root || document];
      if (root || true) {
        const walkShadow = (n) => {
          const all = n.querySelectorAll('*');
          for (const el of all) {
            if (el.shadowRoot) {
              roots.push(el.shadowRoot);
              walkShadow(el.shadowRoot);
            }
          }
        };
        walkShadow(root || document);
      }

      for (const r of roots) {
        // 1) img dari domain blokir → hapus kontainer fixed/absolute terdekat
        const imgs = r.querySelectorAll('img');
        for (const img of imgs) {
          let host = '';
          try { host = new URL(img.src, location.href).hostname; } catch (_) { continue; }
          if (!isBlockedHost(host)) continue;
          let cur = img.parentElement;
          let guard = 0;
          let target = img.parentElement;
          while (cur && cur !== document.body && guard++ < 8) {
            if (isFixedAbs(cur)) { target = cur; break; }
            cur = cur.parentElement;
          }
          if (target && target.isConnected) target.remove();
        }

        // 2) grey-zone: kontainer fixed/absolute kecil + badge "Ad" + CTA dewasa
        const all = r.querySelectorAll('div,section,aside');
        for (let i = all.length - 1; i >= 0; i--) {
          const el = all[i];
          if (!el.isConnected || !isFixedAbs(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > innerWidth || rect.height > innerHeight) continue;
          const t = el.textContent || '';
          if (!ADULT_CTX.test(t)) continue;
          if (hasDescendantText(el, /^Ad$/, true) && hasDescendantText(el, CTA_TEXT)) {
            el.remove();
          }
        }
      }
    };

    process(document);
    for (const f of document.querySelectorAll('iframe')) {
      try {
        if (f.contentDocument) process(f.contentDocument);
      } catch (_) {}
    }
  };

  const obs = new MutationObserver(() => removeAdOverlays());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  removeAdOverlays();
  // Overlay ad kadang muncul setelah pemutar video siap — cek berkala juga.
  setInterval(removeAdOverlays, 2000);
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'loading') removeAdOverlays();
    });
  }

  const isSameSite = (host) => {
    const h = host.toLowerCase();
    if (h === location.hostname) return true;
    return h.endsWith('.' + location.hostname) || location.hostname.endsWith('.' + h);
  };

  const isOverlay = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el === document.documentElement || el === document.body) return false;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    const z = parseInt(cs.zIndex, 10) || 0;
    if (z < AD_Z_INDEX) return false;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) return false;
    const invisible =
      parseFloat(cs.opacity) <= 0.1 ||
      cs.backgroundColor === 'rgba(0, 0, 0, 0)' ||
      cs.backgroundColor === 'transparent';
    if (!invisible) return false;
    return true;
  };

  const realTarget = (x, y) =>
    document.elementsFromPoint(x, y).filter((el) => !isOverlay(el))[0];

  const hitOverlay = (e) =>
    document.elementsFromPoint(e.clientX, e.clientY).some(isOverlay);

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!enabled) return;
      if (e.button !== 0 || !hitOverlay(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const below = realTarget(e.clientX, e.clientY);
      if (!below) return;
      const md = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: e.clientX,
        clientY: e.clientY,
        button: 0,
      });
      md._pass = true;
      below.dispatchEvent(md);
    },
    true
  );

  const passThrough = (e) => {
    if (!enabled) return;
    if (e._pass) return;
    if (e.button !== 0 && e.type !== 'auxclick') return;
    if (!hitOverlay(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const below = realTarget(e.clientX, e.clientY);
    if (!below) return;
    const ck = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: e.clientX,
      clientY: e.clientY,
      button: 0,
    });
    ck._pass = true;
    below.dispatchEvent(ck);
  };

  document.addEventListener('click', passThrough, true);
  document.addEventListener('auxclick', passThrough, true);

  // Anchor: diblokir kalau domain blokir. Synthetic/auto ke host asing = ad → blokir.
  // Klik asli user ke host asing = navigasi sah → boleh jalan + tandai buat background
  // biar tab hasil klik gak dikira popunder.
  document.addEventListener(
    'click',
    (e) => {
      if (!enabled) return;
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      try {
        const u = new URL(a.href, location.href);
        if (isBlockedUrl(u)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (!isSameSite(u.hostname)) {
          if (!e.isTrusted) {
            e.preventDefault();
            e.stopImmediatePropagation();
          } else {
            window.dispatchEvent(
              new CustomEvent('iklan-aman-usernav', { detail: { href: u.href } })
            );
          }
        }
      } catch (_) {}
    },
    true
  );

  const origOpen = window.open.bind(window);
  window.open = function (url, ...rest) {
    if (!enabled) return origOpen(url, ...rest);
    if (!hasGesture()) return null;
    // window.open('') / about:blank = pola popunder (isinya di-set dari luar) → blok.
    if (!url || String(url) === 'about:blank') return null;
    try {
      const u = new URL(String(url), location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (isBlockedUrl(u) || !isSameSite(u.hostname)) return null;
    } catch (_) {}
    return origOpen(url, ...rest);
  };

  // Form submit target=_blank ke host asing = pola popunder (banyak ad pakai <form>).
  document.addEventListener(
    'submit',
    (e) => {
      if (!enabled) return;
      const f = e.target;
      if (!(f instanceof HTMLFormElement)) return;
      if (f.target !== '_blank' && f.target !== '_parent' && f.target !== '_top') return;
      try {
        const u = new URL(f.action || location.href, location.href);
        if (isBlockedUrl(u) || !isSameSite(u.hostname)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      } catch (_) {}
    },
    true
  );

  // Adblock-wall bypass: netralin deteksi biar player gak di-block.
  const bypassAds = () => {
    try {
      window.canRunAds = true;
      const noop = () => true;
      const fab = { check: noop, on: noop, onNotDetected: noop, onDetected: () => {} };
      if (!window.fuckAdBlock) Object.defineProperty(window, 'fuckAdBlock', { value: fab });
      if (!window.blockAdBlock) Object.defineProperty(window, 'blockAdBlock', { value: fab });
    } catch (_) {}
  };
  bypassAds();
})();