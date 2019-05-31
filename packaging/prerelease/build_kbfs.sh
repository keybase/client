#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/keybase}
gopath=${GOPATH:-}

kbfs_dir="$gopath/src/github.com/keybase/client/go/kbfs"
cd "$kbfs_dir"

mkdir -p "$build_dir"

current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
kbfs_build=${KBFS_BUILD:-$build}
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/client/go/kbfs/libkbfs.PrereleaseBuild=$kbfs_build -s -w"
pkg="github.com/keybase/client/go/kbfs/kbfsfuse"
git_remote_helper_pkg="github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase"
redirector_pkg="github.com/keybase/client/go/kbfs/redirector"

if [ "$PLATFORM" = "windows" ]; then
  pkg="github.com/keybase/client/go/kbfs/kbfsdokan"
fi

echo "Building $build_dir/kbfs ($kbfs_build) with $(go version)"
go build -a -tags "$tags" -ldflags "$ldflags" -o "$build_dir/kbfs" $pkg

echo "Building $build_dir/kbfs/kbfsgit ($kbfs_build) with $(go version)"
go build -a -tags "$tags" -ldflags "$ldflags" -o "$build_dir/git-remote-keybase" $git_remote_helper_pkg

echo "Building $build_dir/kbfs/redirector ($kbfs_build) with $(go version)"
go build -a -tags "$tags" -ldflags "$ldflags" -o "$build_dir/keybase-redirector" $redirector_pkg

if [ "$PLATFORM" = "darwin" ]; then
  echo "Signing binaries..."
  code_sign_identity="9FC3A5BC09FA2EE307C04060C918486411869B65" # "Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" $build_dir/kbfs
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" $build_dir/git-remote-keybase
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" $build_dir/keybase-redirector
elif [ "$PLATFORM" = "linux" ]; then
  echo "No codesigning for Linux"
elif [ "$PLATFORM" = "windows" ]; then
  echo "No codesigning for Windows"
else
  echo "Invalid PLATFORM"
  exit 1
fi

kbfs_version=`"$build_dir"/kbfs -version`
echo "KBFS version: $kbfs_version"
