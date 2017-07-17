#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

gopath=${GOPATH:-}
nobuild=${NOBUILD:-} # Don't build go binaries
istest=${TEST:-} # If set to true, only build (for testing)
nopull=${NOPULL:-} # Don't git pull
client_commit=${CLIENT_COMMIT:-} # Commit on client to build from
kbfs_commit=${KBFS_COMMIT:-} # Commit on kbfs to build from
bucket_name=${BUCKET_NAME:-"prerelease.keybase.io"}
platform=${PLATFORM:-} # darwin,linux,windows (Only darwin is supported in this script)
nos3=${NOS3:-} # Don't sync to S3
nowait=${NOWAIT:-} # Don't wait for CI
smoke_test=${SMOKE_TEST:-} # If set to 1, enable smoke testing

if [ "$gopath" = "" ]; then
  echo "No GOPATH"
  exit 1
fi

if [ "$platform" = "" ]; then
  echo "No PLATFORM. You can specify darwin, linux or windows."
  exit 1
fi
echo "Platform: $platform"

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
build_dir_kbnm="/tmp/build_kbnm"
build_dir_updater="/tmp/build_updater"
client_dir="$gopath/src/github.com/keybase/client"
kbfs_dir="$gopath/src/github.com/keybase/kbfs"
updater_dir="$gopath/src/github.com/keybase/go-updater"

if [ ! "$nopull" = "1" ]; then
  "$client_dir/packaging/check_status_and_pull.sh" "$kbfs_dir"
  "$client_dir/packaging/check_status_and_pull.sh" "$updater_dir"
fi

echo "Loading release tool"
"$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$GOPATH/bin/release"

client_branch=`cd "$client_dir" && git rev-parse --abbrev-ref HEAD`
kbfs_branch=`cd "$kbfs_dir" && git rev-parse --abbrev-ref HEAD`
function reset {
  (cd "$client_dir" && git checkout $client_branch)
  (cd "$kbfs_dir" && git checkout $kbfs_branch)
}
trap reset EXIT

if [ -n "$client_commit" ]; then
  cd "$client_dir"
  echo "Checking out $client_commit on client (will reset to $client_branch)"
  git checkout "$client_commit"
fi

if [ -n "$kbfs_commit" ]; then
  cd "$kbfs_dir"
  echo "Checking out $kbfs_commit on kbfs (will reset to $kbfs_branch)"
  git checkout "$kbfs_commit"
fi

# NB: This is duplicated in packaging/linux/build_and_push_packages.sh.
if [ ! "$nowait" = "1" ]; then
  echo "Checking client CI"
  "$release_bin" wait-ci --repo="client" --commit=`git -C $client_dir log -1 --pretty=format:%h` --context="continuous-integration/jenkins/branch" --context="ci/circleci"
  echo "Checking kbfs CI"
  "$release_bin" wait-ci --repo="kbfs" --commit=`git -C $kbfs_dir log -1 --pretty=format:%h` --context="continuous-integration/jenkins/branch"
  echo "Checking updater CI"
  "$release_bin" wait-ci --repo="go-updater" --commit=`git -C $updater_dir log -1 --pretty=format:%h` --context="continuous-integration/travis-ci/push"

  "$client_dir/packaging/slack/send.sh" "CI tests passed! Starting build for $platform."
fi

number_of_builds=1
build_a=""
build_b=""
if [ "$smoke_test" = "1" ]; then
  echo "Enabling smoke testing"
  number_of_builds=2
fi

# Okay, here's where we start generating version numbers and doing builds.
for ((i=1; i<=$number_of_builds; i++)); do
  if [ ! "$nobuild" = "1" ]; then
    BUILD_DIR="$build_dir_keybase" "$dir/build_keybase.sh"
    BUILD_DIR="$build_dir_kbfs" "$dir/build_kbfs.sh"
    BUILD_DIR="$build_dir_kbnm" "$dir/build_kbnm.sh"
    BUILD_DIR="$build_dir_updater" "$dir/build_updater.sh"
  fi

  version=`$build_dir_keybase/keybase version -S`
  kbfs_version=`$build_dir_kbfs/kbfs -version`
  kbnm_version=`$build_dir_kbnm/kbnm -version`
  updater_version=`$build_dir_updater/updater -version`

  save_dir="/tmp/build_desktop"
  rm -rf "$save_dir"

  if [ "$platform" = "darwin" ]; then
    SAVE_DIR="$save_dir" KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" KBNM_BINPATH="$build_dir_kbnm/kbnm" \
      UPDATER_BINPATH="$build_dir_updater/updater" BUCKET_NAME="$bucket_name" S3HOST="$s3host" "$dir/../desktop/package_darwin.sh"
  else
    # TODO: Support linux build here?
    echo "Unknown platform: $platform"
    exit 1
  fi

  if [ "$i" = "1" ]; then
    build_a="$version"
  elif [ "$i" = "2" ]; then
    build_b="$version"
  else
    echo "Invalid build count: $i"
  fi

  BUCKET_NAME="$bucket_name" PLATFORM="$platform" "$dir/s3_index.sh"
done


if [ ! "$istest" = "" ]; then
  "$client_dir/packaging/slack/send.sh" "Finished test build $platform (keybase: $version). See $s3host";
else
  # Promote the build we just made to the test channel -- if smoketest, then
  # promote the first build; if not, then promote the only build.
  S3HOST="$s3host" "$release_bin" promote-test-releases --bucket-name="$bucket_name" --platform="$platform" --release="$build_a"

  if [ "$number_of_builds" = "2" ]; then
    # Announce the new builds to the API server.
    echo "Announcing builds: $build_a and $build_b."
    BUCKET_NAME="$bucket_name" S3HOST="$s3host" "$release_bin" announce-build --build-a="$build_a" --build-b="$build_b" --platform="darwin"
  fi

  BUCKET_NAME="$bucket_name" "$dir/report.sh"

  "$client_dir/packaging/slack/send.sh" "Finished build $platform (keybase: $version, kbfs: $kbfs_version, kbnm: $kbnm_version). See $s3host";
fi
