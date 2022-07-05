#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

rm -rf osxfuse

version=${VERSION:?"Need to set VERSION for Fuse"}
if [ "$version" = "3.10.0" ]; then
  tar -xjf /keybase/team/keybase.builds.macos/osxfuse/osxfuse-3.10.0.tbz
  mv osxfuse-3.10.0 osxfuse
else
  branch="osxfuse-$version"
  # Checkout
  git clone --recursive -b "$branch" git://github.com/osxfuse/osxfuse.git osxfuse
fi

# Patch osxfuse to turn it into kbfuse
./patch.sh

# Compile
rm -rf /tmp/kbfuse*
cd osxfuse
# If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).
# build for 10.11, and have osxfuse builder symlink other versions.
./build.sh -v 5 -t fsbundle -- -s 10.11 -d 10.11 --kext=10.11 --kext="10.12->10.11" --kext="10.13->10.11" --kext="10.14->10.11" --kext="10.15->10.11"

cd $dir
rm -rf kbfuse.bundle
ditto /tmp/kbfuse/fsbundle/kbfuse.fs kbfuse.bundle

# Backup the fsbundle directory in case we need debug symbols later
cd /tmp/kbfuse/fsbundle
tar zcvpf $dir/fsbundle.tgz  .

# Sign the kext
cd $dir
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/10.11/kbfuse.kext
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --force --deep --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

# Verify
codesign --verbose --verify kbfuse.bundle/Contents/Extensions/10.11/kbfuse.kext
codesign --verbose --verify kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --verify kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --verify kbfuse.bundle
