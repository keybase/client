#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dest="$dir/build"
code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"

mkdir -p "/Applications/Keybase.app/Contents/PlugIns"
rm -rf "/Applications/Keybase.app/Contents/PlugIns/FinderSync.appex"

cp -R "$build_dest/Extensions.app/Contents/PlugIns/FinderSync.appex" "/Applications/Keybase.app/Contents/PlugIns/FinderSync.appex"
codesign --verbose --force --deep --sign "$code_sign_identity" /Applications/Keybase.app
