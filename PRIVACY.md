# Privacy Policy — Iklan Aman

Last updated: 2026-08-13

## Data collected

**None.** This extension does not collect, store, send, or sell any personal data.

All logic runs 100% locally in your browser (`chrome.storage.local`). No remote servers, no analytics, no trackers.

## Data stored on your device

Only three things, all in `chrome.storage.local` on your own device:

1. `enabled` — toggle state (ON/OFF).
2. `extra` — the list of domains you added manually via the popup.
3. `sync` — timestamp + rule count of the last sync.

Nothing leaves your browser.

## Optional sync (for developers)

The background worker tries to fetch `http://127.0.0.1:8080/rules` once every 30 minutes for the additional domain list.

- This is **localhost** — your own machine.
- If no server is running on that port, the request fails silently and the extension uses its built-in static list.
- **No user data is sent.** The request is a read-only GET for the domain list.

## Permissions requested & why

| Permission | Reason |
|------------|--------|
| `declarativeNetRequest` | Block requests/navigations to ad & gambling domains |
| `storage` | Store toggle & custom domains on your device |
| `alarms` | Periodic sync (optional) |
| `tabs` | Close popunder tabs that open automatically |

## Contact

Repo & issues: https://github.com/wanglinsaputra/extension-iklan

This privacy policy is available in the repo (file `PRIVACY.md`).