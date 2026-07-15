#!/usr/bin/env bash
#
# Build a Keybase DMG with hdiutil, no external tools.
#
# The Finder layout (icon positions, window size, background image) lives in
# a pre-built .DS_Store template checked in at packaging/desktop/dmg/DSStore,
# originally harvested from an appdmg-built release. The template's background
# alias embeds the volume name and background path, so "Keybase App",
# ".background/Background.png", and the icon filenames must stay in sync with
# it. To change the layout: mount a rw DMG, arrange it in Finder, and copy the
# volume's .DS_Store back over the template.

set -e -u -o pipefail

if [ $# -ne 4 ]; then
	echo "Usage: $0 <app-path> <output-dmg> <assets-dir> <volume-icon.icns>" >&2
	exit 1
fi

app_path="$1"
dmg_path="$2"
assets_dir="$3" # contains DSStore and Background.png
icon_path="$4"

vol_name="Keybase App"

tmp_dir="$(mktemp -d /tmp/make_dmg.XXXXXX)"
staging="$tmp_dir/staging"
rw_dmg="$tmp_dir/rw.dmg"
mount_point="$tmp_dir/mnt"
cleanup() {
	if [ -d "$mount_point" ]; then
		hdiutil detach "$mount_point" -quiet 2>/dev/null || true
	fi
	rm -rf "$tmp_dir"
}
trap cleanup EXIT

mkdir -p "$staging/.background"
# ditto preserves the xattrs and resource forks the codesignature depends on
ditto "$app_path" "$staging/$(basename "$app_path")"
ln -s /Applications "$staging/Applications"
cp "$assets_dir/Background.png" "$staging/.background/Background.png"
cp "$assets_dir/DSStore" "$staging/.DS_Store"
cp "$icon_path" "$staging/.VolumeIcon.icns"

size_mb=$(($(du -sm "$staging" | cut -f1) + 20))
hdiutil create -volname "$vol_name" -fs HFS+ -format UDRW -size "${size_mb}m" -srcfolder "$staging" "$rw_dmg" -quiet

mkdir -p "$mount_point"
hdiutil attach "$rw_dmg" -nobrowse -noautoopen -mountpoint "$mount_point" -quiet
# custom-icon Finder bit on the volume root, so .VolumeIcon.icns is shown
xattr -wx com.apple.FinderInfo \
	"0000000000000000040000000000000000000000000000000000000000000000" "$mount_point"
hdiutil detach "$mount_point" -quiet

rm -f "$dmg_path"
hdiutil convert "$rw_dmg" -format UDZO -imagekey zlib-level=9 -o "$dmg_path" -quiet
echo "Created $dmg_path"
