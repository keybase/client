#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

gopath=${GOPATH:-}
nobuild=${NOBUILD:-} # Don't build go binaries
istest=${TEST:-} # Use test bucket (doesn't trigger prerelease updates)
nopull=${NOPULL:-} # Don't git pull
client_commit=${CLIENT_COMMIT:-} # Commit hash on client to build from
kbfs_commit=${KBFS_COMMIT:-} # Commit hash on kbfs to build from
bucket_name=${BUCKET_NAME:-"prerelease.keybase.io"}
platform=${PLATFORM:-} # darwin,linux,windows (Only darwin is supported in this script)
nos3=${NOS3:-} # Don't sync to S3
nowait=${NOWAIT:-} # Don't wait for CI
build_desc="build"

if [ "$gopath" = "" ]; then
  echo "No GOPATH"
  exit 1
fi

if [ "$platform" = "" ]; then
  echo "No PLATFORM. You can specify darwin, linux or windows."
  exit 1
fi
echo "Platform: $platform"

# If testing, use test bucket
if [ "$istest" = "1" ]; then
  bucket_name="prerelease-test.keybase.io"
  build_desc="test build"
fi

if [ "$nos3" = "1" ]; then
  bucket_name=""
fi

if [ ! "$bucket_name" = "" ]; then
  echo "Bucket name: $bucket_name"
fi

if [ "$bucket_name" = "prerelease.keybase.io" ]; then
  # We have a CNAME for the prerelease bucket
  s3host="https://prerelease.keybase.io"
else
  s3host="https://s3.amazonaws.com/$bucket_name/"
fi

build_dir_keybase="/tmp/build_keybase"
build_dir_kbfs="/tmp/build_kbfs"
build_dir_updater="/tmp/build_updater"
client_dir="$gopath/src/github.com/keybase/client"
kbfs_dir="$gopath/src/github.com/keybase/kbfs"
updater_dir="$gopath/src/github.com/keybase/go-updater"

"$client_dir/packaging/slack/send.sh" "Starting $platform $build_desc"

if [ ! "$nopull" = "1" ]; then
  "$client_dir/packaging/check_status_and_pull.sh" "$client_dir"
  "$client_dir/packaging/check_status_and_pull.sh" "$kbfs_dir"
  "$client_dir/packaging/check_status_and_pull.sh" "$updater_dir"
fi

echo "Loading release tool"
"$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$GOPATH/bin/release"

if [ -n "$client_commit" ]; then
  cd "$client_dir"
  client_branch=`git rev-parse --abbrev-ref HEAD`
  function reset_client {
    (cd "$client_dir" && git checkout $client_branch)
  }
  trap reset_client EXIT
  echo "Checking out $client_commit on client"
  git checkout "$client_commit"
fi

if [ -n "$kbfs_commit" ]; then
  cd "$kbfs_dir"
  kbfs_branch=`git rev-parse --abbrev-ref HEAD`
  function reset_kbfs {
    (cd "$kbfs_dir" && git checkout $kbfs_branch)
  }
  trap reset_kbfs EXIT
  echo "Checking out $kbfs_commit on kbfs"
  git checkout "$kbfs_commit"
fi

# NB: This is duplicated in packaging/linux/build_and_push_packages.sh.
if [ ! "$nowait" = "1" ]; then
  echo "Checking client CI"
  "$release_bin" wait-ci --repo="client" --commit=`git -C $client_dir log -1 --pretty=format:%h` --context="Jenkins job master" --context="ci/circleci"
  echo "Checking kbfs CI"
  "$release_bin" wait-ci --repo="kbfs" --commit=`git -C $kbfs_dir log -1 --pretty=format:%h` --context="Jenkins job master" --context="continuous-integration/appveyor/branch"
  echo "Checking updater CI"
  "$release_bin" wait-ci --repo="go-updater" --commit=`git -C $updater_dir log -1 --pretty=format:%h` --context="continuous-integration/travis-ci/push"
fi

if [ ! "$nobuild" = "1" ]; then
  BUILD_DIR=$build_dir_keybase "$dir/build_keybase.sh"
  BUILD_DIR=$build_dir_kbfs "$dir/build_kbfs.sh"
  BUILD_DIR=$build_dir_updater "$dir/build_updater.sh"
fi

version=`$build_dir_keybase/keybase version -S`
kbfs_version=`$build_dir_kbfs/kbfs -version`
updater_version=`$build_dir_updater/updater -version`

save_dir="/tmp/build_desktop"
rm -rf $save_dir

if [ "$platform" = "darwin" ]; then
  SAVE_DIR="$save_dir" KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" \
    UPDATER_BINPATH="$build_dir_updater/updater" BUCKET_NAME="$bucket_name" S3HOST="$s3host" \
    "$dir/../desktop/package_darwin.sh"
else
  # TODO: Support linux build here?
  echo "Unknown platform: $platform"
  exit 1
fi

BUCKET_NAME="$bucket_name" PLATFORM="$platform" "$dir/s3_index.sh"

"$client_dir/packaging/slack/send.sh" "Finished $platform $build_desc (keybase: $version, kbfs: $kbfs_version). See $s3host"

if [ "$istest" = "" ]; then
  BUCKET_NAME="$bucket_name" "$dir/report.sh"
fi
