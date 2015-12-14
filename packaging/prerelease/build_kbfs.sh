#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/build_kbfs}
mkdir -p $build_dir

repodir="$GOPATH/src/github.com/keybase/kbfs"
cd $repodir

# This might be different for linux, e.g. date -d @$(git log -n1 --format="%at") +%Y%m%d%H%M%S`
date_last_commit=`date -r $(git log -n1 --format="%at") +%Y%m%d%H%M%S`
commit_short=`git log -1 --pretty=format:%h`
build="$date_last_commit+$commit_short"

echo "Building kbfs"
GO15VENDOREXPERIMENT=0 go get -u github.com/keybase/kbfs/kbfsfuse
GO15VENDOREXPERIMENT=0 go build -a -tags "production" -ldflags "-X github.com/keybase/kbfs/libkbfs.CustomBuild=$build" -o $build_dir/kbfs github.com/keybase/kbfs/kbfsfuse

kbfs_version=`$build_dir/kbfs -version`
echo "KBFS version: $kbfs_version"
