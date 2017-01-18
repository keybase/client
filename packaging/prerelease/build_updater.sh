#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/keybase}
gopath=${GOPATH:-}
package="github.com/keybase/go-updater/service"
dest="$build_dir/updater"

src_dir="$gopath/src/$package"
cd "$src_dir"

mkdir -p "$build_dir"

ldflags=""

if [ "$PLATFORM" = "darwin" ]; then
  # To get codesign to work you have to use -ldflags "-s ...", see https://github.com/golang/go/issues/11887
  ldflags="-s $ldflags"
fi

echo "Building $build_dir/updater"
GO15VENDOREXPERIMENT=1 go build -a -ldflags "$ldflags" -o "$dest" "$package"

if [ "$PLATFORM" = "darwin" ]; then
  echo "Signing binary..."
  code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --sign "$code_sign_identity" "$dest"
elif [ "$PLATFORM" = "linux" ]; then
  echo "No codesigning for linux"
elif [ "$PLATFORM" = "windows" ]; then
  echo "No codesigning for windows"
else
  echo "Invalid PLATFORM"
  exit 1
fi

updater_version=`"$build_dir"/updater -version`
echo "Updater version: $updater_version"
