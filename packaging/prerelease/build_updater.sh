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

echo "Building $build_dir/updater"
go build -a -o "$dest" "$package"

if [ "$PLATFORM" = "darwin" ]; then
  echo "Signing binary..."
  code_sign_identity="98767D13871765E702355A74358822D31C0EF51A" # "Developer ID Application: Keybase, Inc. (99229SGT5K)"
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
