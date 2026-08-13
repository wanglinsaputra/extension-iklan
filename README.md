# Iklan Aman - Play Lurus

A Chrome MV3 extension that blocks ads & gambling redirects on streaming sites (movies/anime).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![E2E](https://github.com/wanglinsaputra/extension-iklan/actions/workflows/test.yml/badge.svg)](https://github.com/wanglinsaputra/extension-iklan/actions/workflows/test.yml)

One click on **Play** and it just works. No popunder tabs, no redirects to gambling sites, no "Are you 18+?" ad overlays covering the video.

## Features

- **Block popunders & popup ads** — tabs opened automatically (without your click) get closed instantly.
- **Block gambling redirects** — including the "google search mediator" trick (`google.com/search?q=<gambling-domain>`).
- **Overlay pass-through** — ad overlays covering the play button are clicked through, so clicks reach the video.
- **Remove in-player ad overlays** — "Ad" / "Confirm 18+" banners over the video get removed from the page.
- **Anti adblock-wall** — neutralizes `canRunAds` / FuckAdBlock detection so the player isn't blocked.
- **On/off toggle** in the popup.
- **Add custom blocked domains** from the popup — takes effect immediately, no reload.
- **100% local** — everything runs in your browser, no data is sent to any server.

## Install (developer / unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (the one containing `manifest.json`)

## Domain sync (optional, for developers)

The extension has an optional local sync server so the blocked-domain list can be updated without a store update:

```bash
python3 server/serve.py
```

The server runs at `http://127.0.0.1:8080/rules` and serves the contents of `server/rules.json`:

```json
{
  "domains": ["example-gambling-site.com"]
}
```

**Without the server the extension still works fully** — it uses the built-in static list (`rules/blocklist.json`). The server only runs if you start it.

## Adding blocked domains

- **Quick**: open the extension popup → type the domain → **Add**. Takes effect on all tabs immediately.
- **Permanent in code**: add to `rules/blocklist.json` (static) and/or `server/rules.json` (sync).

## Development

```bash
npm install
npx playwright test     # requires pure Chromium (not branded Chrome)
```

## License

[MIT](LICENSE)

## Repo & Contributing

- Repo: https://github.com/wanglinsaputra/extension-iklan
- Found a new ad domain? Report it via a GitHub issue.
- Pull requests welcome. Run `npx playwright test` before submitting a PR.

## Structure

```
manifest.json        # MV3 configuration
content.js           # content script (MAIN world): overlay, popup guard, ad-overlay remover
bridge.js            # storage bridge → MAIN world
background.js        # service worker: DNR dynamic, sync, popunder tab closer
popup.html/.js       # on/off toggle + add domain
rules/blocklist.json # static blocked-domain list (DNR)
server/serve.py      # optional local sync server
test/                # synthetic test pages + Playwright e2e
```
