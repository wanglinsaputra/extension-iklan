# Iklan Aman - Play Lurus

Extension Chrome MV3 anti-iklan & anti-redirect judol untuk situs streaming film/anime.

Sekali klik **Play** langsung jalan. Tidak ada tab popunder, tidak ada redirect ke situs judol, tidak ada overlay iklan "Are you 18+?" di tengah video.

## Fitur

- **Blokir popunder & popup iklan** — tab baru yang dibuka otomatis (tanpa klik kamu) langsung ditutup.
- **Blokir redirect judol** — termasuk trik "google search mediator" (`google.com/search?q=<domain-judol>`).
- **Overlay pass-through** — overlay iklan yang nutupin tombol play di-tembus, klik langsung ke video.
- **Hapus overlay ad dalam video player** — banner "Ad" / "Confirm 18+" di atas video dihapus dari halaman.
- **Anti adblock-wall** — netralkan deteksi `canRunAds` / FuckAdBlock biar player gak diblokir.
- **Toggle on/off** di popup.
- **Tambah domain blokir manual** dari popup — langsung aktif tanpa reload.
- **100% lokal** — semua berjalan di browser kamu, tidak ada data dikirim ke server.

## Instalasi (developer / unpacked)

1. Buka `chrome://extensions`
2. Aktifkan **Developer mode** (kanan atas)
3. Klik **Load unpacked**
4. Pilih folder ini (folder yang ada `manifest.json`-nya)

## Sinkronisasi domain (opsional, untuk developer)

Extension punya server sinkronisasi lokal supaya daftar domain blokir bisa di-update tanpa update extension:

```bash
python3 server/serve.py
```

Server jalan di `http://127.0.0.1:8080/rules` dan menyajikan isi `server/rules.json`:

```json
{
  "domains": ["contoh-judol.example"]
}
```

**Tanpa server, extension tetap berfungsi penuh** — pakai daftar static bawaan (`rules/blocklist.json`). Server hanya jalan kalau kamu yang menjalankannya.

## Menambah domain blokir

- **Cepat**: buka popup extension → ketik domain → **Tambah**. Langsung aktif di semua tab.
- **Permanen di kode**: tambah ke `rules/blocklist.json` (static) dan/atau `server/rules.json` (sync).

## Development

```bash
npm install
npx playwright test     # butuh Chromium murni (bukan branded Chrome)
```

## Lisensi

[MIT](LICENSE)

## Struktur

```
manifest.json        # konfigurasi MV3
content.js           # content script (world MAIN): overlay, popup guard, ad-overlay remover
bridge.js            # jembatan storage → MAIN world
background.js        # service worker: DNR dynamic, sync, tab popunder closer
popup.html/.js       # toggle on/off + tambah domain
rules/blocklist.json # daftar domain blokir static (DNR)
server/serve.py      # server sync lokal opsional
test/                # halaman uji synthetic + e2e Playwright
```
