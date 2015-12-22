#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/build_keybase}
mkdir -p $build_dir

current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
keybase_build=${KEYBASE_BUILD:-$build}

echo "Building $build_dir/keybase ($keybase_build)"
GO15VENDOREXPERIMENT=1 go build -a -tags "prerelease production" -ldflags "-X github.com/keybase/client/go/libkb.CustomBuild=$keybase_build" -o $build_dir/keybase github.com/keybase/client/go/keybase

version=`$build_dir/keybase version -S`
echo "Keybase version: $version"
