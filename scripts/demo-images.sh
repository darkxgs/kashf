#!/usr/bin/env bash
# Product photos for the demo store, generated for Kashf (no real brand) and
# kept on the image host they were made on. This downloads and resizes them
# into public/. The hero stays a large PNG on purpose: the report should find it.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="https://d8j0ntlcm91z4.cloudfront.net/user_3KEzB9B3k7k7KvaEiefqwv7OPXv"
OUT="public/demo-store/img"
mkdir -p "$OUT" .cache
get() { [ -f ".cache/$1.png" ] || curl -fsSL --retry 3 -o ".cache/$1.png" "$SRC/hf_$2.png"; }
get hero 20261023_151904_9b9368cc-e267-41b3-bcb4-fc827e8109a1
get amber 20261023_151904_3c2f70bb-f618-4b0c-999e-b63f8fdc6d60
get oud 20261023_151905_f537e0bc-86c1-42c9-b935-356df60156a0
get mabkhara 20261023_151904_911ac774-c882-44d1-983f-949043d9db18
get gift 20261023_151904_add09cfb-e1a6-4efa-bfda-694be54f477a
convert .cache/hero.png -resize 2000x -strip "$OUT/hero.png"
convert .cache/amber.png -resize 640x640 -strip -quality 76 "$OUT/amber-crystal.webp"
convert .cache/oud.png -resize 900x900 -strip -quality 92 "$OUT/oud-roller.jpg"
convert .cache/mabkhara.png -resize 640x640 -strip -quality 76 "$OUT/mabkhara.webp"
convert .cache/gift.png -resize 640x640 -strip -quality 76 "$OUT/gift-set.webp"
ls -la "$OUT"
