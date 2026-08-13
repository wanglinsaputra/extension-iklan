#!/usr/bin/env bash
# Build extension zip untuk upload Chrome Web Store.
# Cara: bash tools/build-zip.sh  →  dist/iklan-aman.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
ZIP="$OUT/iklan-aman.zip"

rm -rf "$OUT"
mkdir -p "$OUT"

# File yang wajib masuk manifest + runtime extension.
FILES=(
  manifest.json
  background.js
  content.js
  bridge.js
  popup.html
  popup.js
  icons
  rules/blocklist.json
)

# Zip isi (relatif ke root), tanpa folder luar.
cd "$ROOT"
python3 - "$ZIP" "${FILES[@]}" <<'EOF'
import sys, zipfile, os
out = sys.argv[1]
files = sys.argv[2:]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        if os.path.isdir(f):
            for root, dirs, names in os.walk(f):
                for n in names:
                    p = os.path.join(root, n)
                    z.write(p, p)
        else:
            z.write(f, f)
EOF

echo "OK: $ZIP"
ls -lh "$ZIP"
