# Privacy Policy — Iklan Aman

Terakhir diperbarui: 2026-08-13

## Data yang dikumpulkan

**Tidak ada.** Extension ini tidak mengumpulkan, menyimpan, mengirim, atau menjual data pribadi apa pun.

Semua logika berjalan 100% lokal di browser kamu (`chrome.storage.local`). Tidak ada server remote, tidak ada analytics, tidak ada tracker.

## Data yang disimpan di perangkat

Hanya tiga hal, semua di `chrome.storage.local` perangkat kamu sendiri:

1. `enabled` — status toggle (AKTIF/MATI).
2. `extra` — daftar domain yang kamu tambahkan sendiri lewat popup.
3. `sync` — timestamp + jumlah aturan terakhir.

Tidak ada yang keluar dari browser.

## Sinkronisasi opsional (developer)

Background worker mencoba membaca `http://127.0.0.1:8080/rules` sekali per 30 menit untuk daftar domain tambahan.

- Ini **localhost** — komputer kamu sendiri.
- Kalau tidak ada server yang jalan di port itu, request gagal diam-diam dan extension memakai daftar static bawaan.
- **Tidak ada data pengguna yang dikirim.** Request-nya cuma GET read-only untuk daftar domain.

## Izin yang diminta & kenapa

| Izin | Alasan |
|------|--------|
| `declarativeNetRequest` | Blokir request/navigasi ke domain iklan & judol |
| `storage` | Simpan toggle & domain custom di perangkat |
| `alarms` | Sinkronisasi berkala (opsional) |
| `tabs` | Tutup tab popunder yang muncul otomatis |

## Kontak

Repo & issue: https://github.com/wanglinsaputra/extension-iklan

Privacy policy ini tersedia di repo (file `PRIVACY.md`).