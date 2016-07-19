#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

version=${VERSION:?"Need to set VERSION for Fuse"}

# Checkout
rm -rf osxfuse
git clone --recursive -b osxfuse-$version git://github.com/osxfuse/osxfuse.git osxfuse

# Patch osxfuse to turn it into kbfuse
./patch.sh

# Compile
rm -rf /tmp/kbfuse*
cd osxfuse
# If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).
./build.sh -t fsbundle

cd $dir
rm -rf kbfuse.bundle
ditto /tmp/kbfuse/fsbundle/kbfuse.fs kbfuse.bundle

# Fix sym links for supported OS's
cd $dir/kbfuse.bundle/Contents/Extensions
ln -s 10.10 10.11
ln -s 10.10 10.12

# Backup the fsbundle directory in case we need debug symbols later
cd /tmp/kbfuse/fsbundle
tar zcvpf $dir/fsbundle.tgz  .

# Sign the kext
cd $dir
codesign --verbose --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/10.10/kbfuse.kext
codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

# Verify
codesign -dvvvv kbfuse.bundle/Contents/Extensions/10.10/kbfuse.kext
codesign -dvvvv kbfuse.bundle
