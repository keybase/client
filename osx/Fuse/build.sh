#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

rm -rf osxfuse macfuse

version=${VERSION:?"Need to set VERSION for Fuse"}
if [ "$version" = "4.2.4" ]; then
  tar -xjf /Volumes/Keybase/team/keybase.builds.macos/macfuse/macfuse-4.2.4-src.tbz
  mv macfuse-4.2.4-src macfuse
else
  echo "Unsupported VERSION"
  exit 1
fi

# Patch macfuse to turn it into kbfuse
./patch.sh

# Compile
rm -rf /tmp/kbfuse*
cd macfuse
# If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).
# use 11.3 SDK (-s) and set deployment target 11.13 (-d). Build for macOS 11 kernel, and support up to Darwin 21 (macOS 12).
./build.sh -v 5 -t filesystembundle -- -s 11.3 -d 11.3 --kext="11,11.3,21" --kext="12->11"

cd $dir
rm -rf kbfuse.bundle
ditto /tmp/kbfuse/filesystembundle/kbfuse.fs kbfuse.bundle

# Backup the filesystembundle directory in case we need debug symbols later
cd /tmp/kbfuse/filesystembundle
tar zcvpf $dir/fsbundle.tgz  .

# Sign the kext
cd $dir
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/11/kbfuse.kext
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --force --deep --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

# Verify
codesign --verbose --verify kbfuse.bundle/Contents/Extensions/11/kbfuse.kext
codesign --verbose --verify kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --verify kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --verify kbfuse.bundle
