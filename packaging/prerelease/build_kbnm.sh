#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/keybase}

mkdir -p "$build_dir"

current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
kbnm_build=${KBNM_BUILD:-$build}
tags=${TAGS:-"prerelease production"}
ldflags="-X main.Version=$kbnm_build -s -w"
pkg="github.com/keybase/client/go/kbnm"

echo "Building $build_dir/kbnm ($kbnm_build) with $(go version)"
go build -a -tags "$tags" -ldflags "$ldflags" -o "$build_dir/kbnm" "$pkg"

if [ "$PLATFORM" = "darwin" ]; then
  echo "Signing binary..."
  code_sign_identity="9FC3A5BC09FA2EE307C04060C918486411869B65" # "Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" $build_dir/kbnm
elif [ "$PLATFORM" = "linux" ]; then
  echo "No codesigning for Linux"
elif [ "$PLATFORM" = "windows" ]; then
  echo "No codesigning for Windows"
else
  echo "Invalid PLATFORM"
  exit 1
fi

kbnm_version=`"$build_dir"/kbnm -version`
echo "KBNM version: $kbnm_version"
