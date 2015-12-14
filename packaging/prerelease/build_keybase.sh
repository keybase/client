#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/tmp/build_keybase}
mkdir -p $build_dir

# This might be different for linux, e.g. date -d @$(git log -n1 --format="%at") +%Y%m%d%H%M%S`
date_last_commit=`date -r $(git log -n1 --format="%at") +%Y%m%d%H%M%S`
commit_short=`git log -1 --pretty=format:%h`
build="$date_last_commit+$commit_short"

echo "Building keybase"
GO15VENDOREXPERIMENT=1 go build -a -tags "production" -ldflags "-X github.com/keybase/client/go/libkb.CustomBuild=$build" -o $build_dir/keybase github.com/keybase/client/go/keybase

version=`$build_dir/keybase version -S`
echo "Keybase version: $version"
