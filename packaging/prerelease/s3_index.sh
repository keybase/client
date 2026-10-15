#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

# If editing this file, you may also want to update windows/s3_prerelease.cmd

# shellcheck source=packaging/lib.sh
source "$dir/../lib.sh"

bucket_name=${BUCKET_NAME:-}
platform=${PLATFORM:-}
istest=${TEST:-}

if [ "$bucket_name" = "" ]; then
  echo "No BUCKET_NAME"
  exit 1
fi

if [ "$platform" = "" ]; then
  echo "No PLATFORM"
  exit 1
fi

kb_release_bin
echo "$(go version)"

echo "Creating index files"
if [ "$platform" = "darwin" ] || [ "$platform" = "darwin-arm64" ]; then
  prefix=$platform
  if [ "$istest" = "1" ]; then
    prefix="$platform-test"
  fi
  "$KB_RELEASE_BIN" index-html --bucket-name="$bucket_name" --prefixes="$prefix/" --upload="$prefix/index.html"

  "$KB_RELEASE_BIN" index-html --bucket-name="$bucket_name" --prefixes="electron-sourcemaps/" --upload="electron-sourcemaps/index.html"
elif [ "$platform" = "linux" ]; then
  "$KB_RELEASE_BIN" index-html --bucket-name="$bucket_name" --prefixes="linux_binaries/deb/" --upload="linux_binaries/deb/index.html"
  "$KB_RELEASE_BIN" index-html --bucket-name="$bucket_name" --prefixes="linux_binaries/rpm/" --upload="linux_binaries/rpm/index.html"
elif [ "$platform" = "windows" ]; then
  "$KB_RELEASE_BIN" index-html --bucket-name="$bucket_name" --prefixes="windows/" --upload="windows/index.html"
else
  echo "Invalid platform: $platform"
  exit 1
fi
