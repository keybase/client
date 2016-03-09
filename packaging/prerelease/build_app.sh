#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

GOPATH=${GOPATH:-}
nobuild=${NOBUILD:-} # Don't build go binaries
istest=${TEST:-} # Use test bucket (doesn't trigger prerelease updates)
nopull=${NOPULL:-} # Don't git pull
client_commit=${CLIENT_COMMIT:-} # Commit hash on client to build from
kbfs_commit=${KBFS_COMMIT:-} # Commit hash on kbfs to build from
bucket_name=${BUCKET_NAME:-"prerelease.keybase.io"}
platform=${PLATFORM:-`uname`}
nos3=${NOS3:-} # Don't sync to S3

if [ "$GOPATH" = "" ]; then
  echo "No GOPATH"
  exit 1
fi

# If testing, use test bucket
if [ "$istest" = "1" ]; then
  bucket_name="prerelease-test.keybase.io"
fi

if [ "$nos3" = "1" ]; then
  bucket_name=""
fi

if [ ! "$bucket_name" = "" ]; then
  echo "Using S3 bucket: $bucket_name"
fi

build_dir_keybase="/tmp/build_keybase"
build_dir_kbfs="/tmp/build_kbfs"
client_dir="$GOPATH/src/github.com/keybase/client"
kbfs_dir="$GOPATH/src/github.com/keybase/kbfs"

"$client_dir/packaging/slack/send.sh" "Starting build"

if [ ! "$nopull" = "1" ]; then
  "$client_dir/packaging/check_status_and_pull.sh" "$client_dir"
  "$client_dir/packaging/check_status_and_pull.sh" "$kbfs_dir"
fi

if [ -n "$client_commit" ]; then
  echo "Checking out $client_commit on client"
  (cd "$client_dir" && git checkout "$client_commit")
else
  (cd "$client_dir" && git checkout master)
fi

if [ -n "$kbfs_commit" ]; then
  echo "Checking out $kbfs_commit on kbfs"
  (cd "$kbfs_dir" && git checkout "$kbfs_commit")
else
  (cd "$kbfs_dir" && git checkout master)
fi

if [ ! "$nobuild" = "1" ]; then
  BUILD_DIR=$build_dir_keybase ./build_keybase.sh
  BUILD_DIR=$build_dir_kbfs ./build_kbfs.sh
fi

cd $dir/../desktop
save_dir="/tmp/build_desktop"
rm -rf $save_dir

if [ "$platform" = "Darwin" ]; then
  SAVE_DIR=$save_dir KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" BUCKET_NAME=$bucket_name ./package_darwin.sh
else
  # TODO: Support linux build here?
  echo "Unknown platform: $platform"
  exit 1
fi

cd $dir
BUCKET_NAME=$bucket_name ./s3_index.sh

"$client_dir/packaging/slack/send.sh" "Finished build. See https://s3.amazonaws.com/$bucket_name/index.html"
