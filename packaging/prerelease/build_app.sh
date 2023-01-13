#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

gopath=${GOPATH:-}
nobuild=${NOBUILD:-} # Don't build go binaries
istest=${TEST:-} # If set to true, only build (for testing)
nopull=${NOPULL:-} # Don't git pull
client_commit=${CLIENT_COMMIT:-} # Commit on client to build from
bucket_name=${BUCKET_NAME:-"prerelease.keybase.io"}
platform=${PLATFORM:-} # darwin,darwin-arm64,linux,windows (Only darwin/darwin-arm64 is supported in this script)
nos3=${NOS3:-} # Don't sync to S3
nowait=${NOWAIT:-} # Don't wait for CI
smoke_test=${SMOKE_TEST:-} # If set to 1, enable smoke testing
skip_notarize=${NONOTARIZE:-} # Skip notarize
arch=${ARCH:-"amd64"} # architecture

if [ "$gopath" = "" ]; then
  echo "No GOPATH"
  exit 1
fi

if [ "$platform" = "" ]; then
  echo "No PLATFORM. You can specify darwin, darwin-arm64, linux or windows."
  exit 1
fi
echo "Platform: $platform"

if [ "$nos3" = "1" ]; then
  bucket_name=""
fi

if [ ! "$bucket_name" = "" ]; then
  echo "Bucket name: $bucket_name"
fi

s3host="https://s3.amazonaws.com/$bucket_name"

build_dir_keybase="/tmp/build_keybase"
build_dir_kbfs="/tmp/build_kbfs"
build_dir_kbnm="/tmp/build_kbnm"
build_dir_updater="/tmp/build_updater"
client_dir=${CLIENT_DIR:-"$gopath/src/github.com/keybase/client"}
kbfs_dir="$client_dir/go/kbfs"
updater_dir=${UPDATER_DIR:-"$gopath/src/github.com/keybase/go-updater"}

if [ ! "$nopull" = "1" ]; then
  "$client_dir/packaging/check_status_and_pull.sh" "$updater_dir"
fi

echo "Loading release tool"
(cd "$client_dir/go/buildtools"; go install "github.com/keybase/release")
release_bin="$GOPATH/bin/release"
echo "$(go version)"

client_branch=$(cd "$client_dir" && git rev-parse --abbrev-ref HEAD)
function reset {
  (cd "$client_dir" && git checkout "$client_branch")
}
trap reset EXIT

if [ -n "$client_commit" ]; then
  cd "$client_dir"
  echo "Checking out $client_commit on client (will reset to $client_branch)"
  git checkout "$client_commit"
  # If commit is hash, this fails and is unnecessary, if branch it's needed to
  # update if it has changed.
  git pull || true
fi

# NB: This is duplicated in packaging/linux/build_and_push_packages.sh.
if [ ! "$nowait" = "1" ]; then
  echo "Checking client CI"
  "$release_bin" wait-ci --repo="client" --commit=$(git -C "$client_dir" log -1 --pretty=format:%h) --context="continuous-integration/jenkins/branch" --context="ci/circleci"
  echo "Checking updater CI"
  "$release_bin" wait-ci --repo="go-updater" --commit=$(git -C "$updater_dir" log -1 --pretty=format:%h) --context="continuous-integration/travis-ci/push"

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

  # required for cross compilation to arm64 on darwin amd64 machine.
  export CGO_ENABLED=1
  current_date=`date -u +%Y%m%d%H%M%S` # UTC
  commit_short=`git log -1 --pretty=format:%h`
  build="$current_date+$commit_short"
  # Consumed by build_keybase.sh and on darwin-arm64 builds below. We the value
  # here so it is consistent across the build compilation and build announcement
  # since we can't echo the version of the binary when cross compiling.
  KEYBASE_BUILD=$build
  KBNM_BUILD=$build
  KBFS_BUILD=$build
  kb_version="$(grep 'Version = ' $client_dir/go/libkb/version.go | sed 's/.*Version = \"\(.*\)\"/\1/')"
  KEYBASE_VERSION="$kb_version-$KEYBASE_BUILD"
  KBNM_VERSION="$kb_version-$KBNM_BUILD"
  KBFS_VERSION="$kb_version-$KBFS_BUILD"

  echo "KEYBASE_VERSION: $KEYBASE_VERSION"
  echo "KNBM_VERSION: $KBNM_VERSION"
  echo "KBFS_VERSION: $KBFS_VERSION"
  if [ ! "$nobuild" = "1" ]; then
    KEYBASE_BUILD="$KEYBASE_BUILD" BUILD_DIR="$build_dir_keybase" "$dir/build_keybase.sh"
    KBFS_BUILD="$KBFS_BUILD" BUILD_DIR="$build_dir_kbfs" CLIENT_DIR="$client_dir" "$dir/build_kbfs.sh"
    KBNM_BUILD="$KBNM_BUILD" BUILD_DIR="$build_dir_kbnm" "$dir/build_kbnm.sh"
    BUILD_DIR="$build_dir_updater" UPDATER_DIR="$updater_dir" "$dir/build_updater.sh"
  fi

  version="$KEYBASE_VERSION"
  kbfs_version="$KBFS_VERSION"
  kbnm_version="$KBNM_VERSION"
  updater_version="" # noop, just used for logging
  if [ ! "$PLATFORM" == "darwin-arm64" ]; then # we can't run the arm64 binary on the amd64 build machine!
    version=$($build_dir_keybase/keybase version -S)
    kbfs_version=$($build_dir_kbfs/kbfs -version)
    kbnm_version=$($build_dir_kbnm/kbnm -version)
    updater_version=$($build_dir_updater/updater -version)
  fi

  save_dir="/tmp/build_desktop"
  rm -rf "$save_dir"

  if [ "$platform" = "darwin" ] || [ "$platform" = "darwin-arm64" ]; then
    SAVE_DIR="$save_dir" KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" GIT_REMOTE_KEYBASE_BINPATH="$build_dir_kbfs/git-remote-keybase" REDIRECTOR_BINPATH="$build_dir_kbfs/keybase-redirector" KBNM_BINPATH="$build_dir_kbnm/kbnm" \
      UPDATER_BINPATH="$build_dir_updater/updater" BUCKET_NAME="$bucket_name" S3HOST="$s3host" SKIP_NOTARIZE="$skip_notarize" PLATFORM="$platform" \
      KEYBASE_VERSION="$KEYBASE_VERSION" KBNM_VERSION="$KBFS_VERSION" KBFS_VERSION="$KBFS_VERSION" "$dir/../desktop/package_darwin.sh"
  else
    # TODO: Support Linux build here?
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


if [ "$istest" = "1" ]; then
  "$client_dir/packaging/slack/send.sh" "Finished *test* build $platform (keybase: $version). See $s3host/$platform-test/index.html"
else
  # Promote the build we just made to the test channel -- if smoketest, then
  # promote the first build; if not, then promote the only build.
  S3HOST="$s3host" "$release_bin" promote-test-releases --bucket-name="$bucket_name" --platform="$platform" --release="$build_a"

  if [ "$number_of_builds" = "2" ]; then
    # Announce the new builds to the API server.
    echo "Announcing builds: $build_a and $build_b."
    BUCKET_NAME="$bucket_name" S3HOST="$s3host" "$release_bin" announce-build --build-a="$build_a" --build-b="$build_b" --platform="$platform"
  fi

  BUCKET_NAME="$bucket_name" "$dir/report.sh"

  "$client_dir/packaging/slack/send.sh" "Finished build $platform (keybase: $version, kbfs: $kbfs_version, kbnm: $kbnm_version, updater: $updater_version). See $s3host";
fi
