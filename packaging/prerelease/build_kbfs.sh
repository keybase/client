#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

NOPULL=${NOPULL:-0} # Don't check and pull repos

build_dir=${BUILD_DIR:-/tmp/build_kbfs}
mkdir -p $build_dir

repodir="$GOPATH/src/github.com/keybase/kbfs"
cd $repodir

current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
kbfs_build=${KBFS_BUILD:-$build}

echo "Building $build_dir/kbfs ($kbfs_build)"
GO15VENDOREXPERIMENT=1 go build -a -tags "prerelease production" -ldflags "-X github.com/keybase/kbfs/libkbfs.CustomBuild=$kbfs_build" -o $build_dir/kbfs github.com/keybase/kbfs/kbfsfuse

kbfs_version=`$build_dir/kbfs -version`
echo "KBFS version: $kbfs_version"
