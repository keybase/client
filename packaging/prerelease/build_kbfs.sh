#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"
# shellcheck source=packaging/lib.sh
source "$dir/../lib.sh"

build_dir=${BUILD_DIR:-/tmp/keybase}

kbfs_dir="$CLIENT_DIR/go/kbfs"
cd "$kbfs_dir"

mkdir -p "$build_dir"

kbfs_build=${KBFS_BUILD:-$(kb_build_id)}
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/client/go/kbfs/libkbfs.PrereleaseBuild=$kbfs_build -s -w"
pkg="github.com/keybase/client/go/kbfs/kbfsfuse"
git_remote_helper_pkg="github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase"
redirector_pkg="github.com/keybase/client/go/kbfs/redirector"
arch=${ARCH:-"amd64"}

if [ "$PLATFORM" = "windows" ]; then
  pkg="github.com/keybase/client/go/kbfs/kbfsdokan"
fi

echo "Building $build_dir/kbfs ($kbfs_build) with $(go version) on arch: $arch"
GOARCH="$arch" go build -tags "$tags" -ldflags "$ldflags" -o "$build_dir/kbfs" $pkg

echo "Building $build_dir/kbfs/kbfsgit ($kbfs_build) with $(go version) on arch: $arch"
GOARCH="$arch" go build -tags "$tags" -ldflags "$ldflags" -o "$build_dir/git-remote-keybase" $git_remote_helper_pkg

if [ "$PLATFORM" = "linux" ]; then
  echo "Building $build_dir/kbfs/redirector ($kbfs_build) with $(go version) on arch: $arch"
  GOARCH="$arch" go build -tags "$tags" -ldflags "$ldflags" -o "$build_dir/keybase-redirector" $redirector_pkg
fi

kb_sign_binary "$build_dir/kbfs" "$build_dir/git-remote-keybase"

if [ ! "$PLATFORM" = "darwin-arm64" ]; then # we can't run the arm64 binary on the amd64 build machine!
  kbfs_version=$("$build_dir"/kbfs -version)
  echo "KBFS version: $kbfs_version"
fi
