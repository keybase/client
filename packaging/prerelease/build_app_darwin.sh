#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

GOPATH=${GOPATH:-}

if [ "$GOPATH" = "" ]; then
  echo "No GOPATH"
  exit 1
fi

build_dir_keybase="/tmp/build_keybase"
build_dir_kbfs="/tmp/build_kbfs"
clientdir="$GOPATH/src/github.com/keybase/client"

"$clientdir/packaging/check_status_and_pull.sh" "$clientdir"
BUILD_DIR=$build_dir_keybase ./build_keybase.sh

"$clientdir/packaging/check_status_and_pull.sh" "$GOPATH/src/github.com/keybase/kbfs"
BUILD_DIR=$build_dir_kbfs ./build_kbfs.sh

cd $dir/../desktop
save_dir="/tmp/build_desktop"
SAVE_DIR=$save_dir KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" ./package_darwin.sh

s3cmd sync --skip-existing $save_dir/* s3://keybase-app/
