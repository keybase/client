#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/keybase}
gopath=${GOPATH:-}
package="github.com/keybase/go-updater/service"
dest="$build_dir/updater"
arch=${ARCH:-"amd64"}

src_dir=${UPDATER_DIR:-"$gopath/src/$package"}
cd "$src_dir"

mkdir -p "$build_dir"

echo "Building $build_dir/updater with $(go version) on arch: $arch"
GOARCH="$arch" go build -a -o "$dest" "$package"

if [ "$PLATFORM" = "darwin" ] || [ "$PLATFORM" = "darwin-arm64" ]; then
  echo "Signing binary..."
  code_sign_identity="9FC3A5BC09FA2EE307C04060C918486411869B65" # "Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$dest"
elif [ "$PLATFORM" = "linux" ]; then
  echo "No codesigning for Linux"
elif [ "$PLATFORM" = "windows" ]; then
  echo "No codesigning for Windows"
else
  echo "Invalid PLATFORM"
  exit 1
fi

if [ ! "$PLATFORM" = "darwin-arm64" ]; then # we can't run the arm64 binary on the amd64 build machine!
  updater_version=$("$build_dir"/updater -version)
  echo "Updater version: $updater_version"
fi
