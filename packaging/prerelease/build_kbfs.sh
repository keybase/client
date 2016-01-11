#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/build_kbfs}
mkdir -p $build_dir

current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
kbfs_build=${KBFS_BUILD:-$build}
tags=${TAGS:-"prerelease production"}
platform=${PLATFORM:-`uname`}
ldflags="-X github.com/keybase/kbfs/libkbfs.CustomBuild=$kbfs_build"

if [ "$platform" = "Darwin" ]; then
  # To get codesign to work you have to use -ldflags "-s ...", see https://github.com/golang/go/issues/11887
  ldflags="-s $ldflags"
fi

echo "Building $build_dir/kbfs ($kbfs_build)"
GO15VENDOREXPERIMENT=1 go build -a -tags "$tags" -ldflags "$ldflags" -o $build_dir/kbfs github.com/keybase/kbfs/kbfsfuse

if [ "$platform" = "Darwin" ]; then
  code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --timestamp=none --sign "$code_sign_identity" $build_dir/kbfs
fi

kbfs_version=`$build_dir/kbfs -version`
echo "KBFS version: $kbfs_version"
