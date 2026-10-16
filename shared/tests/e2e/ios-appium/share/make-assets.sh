#!/bin/bash
# Generates the files the iOS share-source matrix (share.test.ts) shares, into a temp dir.
#
# Usage: make-assets.sh <out-dir>
#
# Uses only what a stock Mac has (perl, sips, cupsfilter, zip). ImageMagick (`magick`) or `cwebp`
# add webp and ffmpeg adds the videos; without them those files are left out, and the flows that
# need them skip with the reason. photo.avif is a 10-bit AVIF encoded through ImageIO (make-avif.swift),
# the form Safari re-encodes a page's AVIF to before sharing it.
set -euo pipefail
OUT="${1:?usage: make-assets.sh <out-dir>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$OUT"
cd "$OUT"

note() { echo "make-assets: $*"; }

# A w x h PPM gradient whose tint comes from r/g/b, then converted by sips. Rows repeat, so even
# 8000x6000 writes in a second or two.
ppm() {
  local w=$1 h=$2 r=$3 g=$4 b=$5 out=$6
  perl -e '
    my ($w, $h, $r, $g, $b) = @ARGV;
    my $row = "";
    for my $x (0 .. $w - 1) { $row .= pack("CCC", ($r + $x) % 256, $g, ($b + $x / 4) % 256) }
    print "P6\n$w $h\n255\n";
    for my $y (0 .. $h - 1) { print $row }
  ' "$w" "$h" "$r" "$g" "$b" > "$out"
}

image() {
  local w=$1 h=$2 r=$3 g=$4 b=$5 format=$6 out=$7
  ppm "$w" "$h" "$r" "$g" "$b" "$OUT/.src.ppm"
  sips -s format "$format" "$OUT/.src.ppm" --out "$out" > /dev/null
  rm -f "$OUT/.src.ppm"
}

# Five distinct small photos, for single and multi-photo shares.
i=0
for name in photo-a photo-b photo-c photo-d photo-e; do
  image 640 480 $((i * 50)) $((200 - i * 30)) 90 png "$name.png"
  i=$((i + 1))
done
# A phone-screen-sized PNG, as a screenshot would be.
image 1179 2556 30 120 200 png screenshot.png
# Large originals: the extension must copy them, never decode them.
image 8000 6000 10 80 160 tiff big.tif
image 8000 6000 160 80 10 png big.png
image 1200 900 90 160 40 heic photo.heic
image 1200 900 200 40 90 tiff small.tif

if command -v magick > /dev/null; then
  magick -size 1200x900 plasma:fractal photo.webp
elif command -v cwebp > /dev/null; then
  sips -s format png small.tif --out .w.png > /dev/null
  cwebp -quiet .w.png -o photo.webp
  rm -f .w.png
else
  note "no ImageMagick or cwebp: photo.webp left out"
fi

if ! swift "$HERE/make-avif.swift" photo.avif 1200 900 2> /dev/null; then
  rm -f photo.avif
  note "no AVIF encoder: photo.avif left out"
fi

if command -v ffmpeg > /dev/null; then
  ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=640x360:rate=30 -f lavfi -i sine=frequency=440 \
    -t 5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest short.mp4
  ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=330 \
    -t 75 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -shortest long-1080p.mp4
else
  note "no ffmpeg: short.mp4 and long-1080p.mp4 left out"
fi

printf 'Share matrix document\n' > .doc.txt
cupsfilter .doc.txt > doc.pdf 2> /dev/null
rm -f .doc.txt
rm -f bundle.zip
zip -q -j bundle.zip doc.pdf photo-a.png
: > empty.dat

cat > contact.vcf << 'VCF'
BEGIN:VCARD
VERSION:3.0
N:Matrix;Share;;;
FN:Share Matrix
ORG:Share Matrix Org
TEL;TYPE=CELL:+1 555 0100
EMAIL:share-matrix@example.com
END:VCARD
VCF

# Pages for the Safari sources. Images carry alt text so they can be found and long-pressed.
cat > index.html << 'HTML'
<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Share Matrix</title></head>
<body><h1>Share Matrix</h1><img src="photo-a.png" alt="matrix photo" style="width:300px">
<p><a href="short.mp4">mp4 link</a></p></body></html>
HTML
cat > text.html << 'HTML'
<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Share Matrix Text</title></head>
<body><textarea id="t" aria-label="plain text" rows="4" cols="30">Share matrix plain text</textarea>
<textarea id="u" aria-label="url text" rows="4" cols="30">Share matrix link https://keybase.io/docs here</textarea></body></html>
HTML
note "assets in $OUT"
