#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

rm -rf osxfuse macfuse

version=${VERSION:?"Need to set VERSION for Fuse"}
if [ "$version" = "5.0.6" ]; then
  tar -xjf ~/Downloads/macfuse-5.0.6-src-mike.tgz
  #mv macfuse-5.0.6-src-mike macfuse
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
# use 12.3 SDK (-s) and set deployment target 12.3 (-d). Build for macOS 12 kernel, and support up to Darwin 23 (macOS 14).
./build.sh -v 5 -t filesystembundle -- -s 26.0 -d 12.3 --kext="12,26.0,25" --kext="26->12" --kext="15->12" --kext="14->12" --kext="13->12" --code-sign-identity="Developer ID Application: Keybase, Inc."

cd $dir
rm -rf kbfuse.bundle
ditto ~/Desktop/kbfuse-5.0.6/filesystembundle/Products/kbfuse.fs kbfuse.bundle

# Backup the filesystembundle directory in case we need debug symbols later
cd ~/Desktop/kbfuse-5.0.6/filesystembundle
tar zcvpf $dir/fsbundle.tgz  .

# Sign the kext
cd $dir
codesign --force --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/12/kbfuse.kext
codesign --force --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --force --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --force --verbose --force --deep --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

# Verify
codesign --verbose --verify kbfuse.bundle/Contents/Extensions/12/kbfuse.kext
codesign --verbose --verify kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --verify kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --verify kbfuse.bundle
