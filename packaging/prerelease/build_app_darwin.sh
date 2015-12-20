#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

GOPATH=${GOPATH:-}
NOPULL=${NOPULL:-} # Don't check and pull repos

if [ "$GOPATH" = "" ]; then
  echo "No GOPATH"
  exit 1
fi

build_dir_keybase="/tmp/build_keybase"
build_dir_kbfs="/tmp/build_kbfs"
clientdir="$GOPATH/src/github.com/keybase/client"
bucket_name="prerelease.keybase.io"

"$clientdir/packaging/slack/send.sh" "Starting build"

if [ ! "$NOPULL" = "1" ]; then
  "$clientdir/packaging/check_status_and_pull.sh" "$clientdir"
  "$clientdir/packaging/check_status_and_pull.sh" "$GOPATH/src/github.com/keybase/kbfs"
# else
#   # Only save to bucket if we are checked and pulled
#   bucket_name=""
fi

BUILD_DIR=$build_dir_keybase ./build_keybase.sh
BUILD_DIR=$build_dir_kbfs ./build_kbfs.sh

cd $dir/../desktop
save_dir="/tmp/build_desktop"
rm -rf $save_dir
SAVE_DIR=$save_dir KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" BUCKET_NAME=$bucket_name ./package_darwin.sh
