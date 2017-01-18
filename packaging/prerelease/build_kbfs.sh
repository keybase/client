#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/keybase}
gopath=${GOPATH:-}

kbfs_dir="$gopath/src/github.com/keybase/kbfs"
cd "$kbfs_dir"

mkdir -p "$build_dir"

current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
kbfs_build=${KBFS_BUILD:-$build}
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/kbfs/libkbfs.PrereleaseBuild=$kbfs_build"
pkg="github.com/keybase/kbfs/kbfsfuse"

if [ "$PLATFORM" = "darwin" ]; then
  # To get codesign to work you have to use -ldflags "-s ...", see https://github.com/golang/go/issues/11887
  ldflags="-s $ldflags"
elif [ "$PLATFORM" = "windows" ]; then
  pkg="github.com/keybase/kbfs/kbfsdokan"
fi

echo "Building $build_dir/kbfs ($kbfs_build)"
go build -a -tags "$tags" -ldflags "$ldflags" -o "$build_dir/kbfs" $pkg

if [ "$PLATFORM" = "darwin" ]; then
  echo "Signing binary..."
  code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --sign "$code_sign_identity" $build_dir/kbfs
elif [ "$PLATFORM" = "linux" ]; then
  echo "No codesigning for linux"
elif [ "$PLATFORM" = "windows" ]; then
  echo "No codesigning for windows"
else
  echo "Invalid PLATFORM"
  exit 1
fi

kbfs_version=`"$build_dir"/kbfs -version`
echo "KBFS version: $kbfs_version"
