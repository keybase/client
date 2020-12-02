#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

rm -rf osxfuse macfuse

version=${VERSION:?"Need to set VERSION for Fuse"}
if [ "$version" = "4.0.4" ]; then
  tar -xjf /Volumes/Keybase/team/keybase.builds.macos/macfuse/macfuse-4.0.4-src.tbz
  mv macfuse-4.0.4-src macfuse
else
  branch="osxfuse-$version"
  # Checkout
  git clone --recursive -b "$branch" git://github.com/osxfuse/osxfuse.git osxfuse
fi

# Patch macfuse to turn it into kbfuse
./patch.sh

# Compile
rm -rf /tmp/kbfuse*
cd macfuse
# If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).
# build for 10.11, and have osxfuse builder symlink other versions.
./build.sh -v 5 --target=filesystembundle -- \
  --sdk=11.0 --deployment-target=11.0 --kext=11.0 --kext="11.1->11.0"
./build.sh -v 5 --target=filesystembundle -- \
  --sdk=10.14 --deployment-target=10.14 --kext=10.14 --kext="10.15->10.14"

cd $dir
rm -rf kbfuse.bundle
ditto /tmp/kbfuse/filesystembundle/kbfuse.fs kbfuse.bundle

# manually add 11.0 stuff in since the last built target was 10.14 and the
# resulting bundle doesn't have 11.0
ditto /tmp/kbfuse/kernelextension-11.0 kbfuse.bundle/Contents/Extensions/11.0
pushd kbfuse.bundle/Contents/Extensions && ln -s 11.0 11.1 && popd

# Backup the filesystembundle directory in case we need debug symbols later
cd /tmp/kbfuse/filesystembundle
tar zcvpf $dir/fsbundle.tgz  .

# Sign the kext
cd $dir
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/11.0/kbfuse.kext
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/10.14/kbfuse.kext
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --force --deep --timestamp --options runtime --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

# Verify
codesign --verbose --verify kbfuse.bundle/Contents/Extensions/10.14/kbfuse.kext
codesign --verbose --verify kbfuse.bundle/Contents/Extensions/11.0/kbfuse.kext
codesign --verbose --verify kbfuse.bundle/Contents/Resources/mount_kbfuse
codesign --verbose --verify kbfuse.bundle/Contents/Resources/load_kbfuse
codesign --verbose --verify kbfuse.bundle
