#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

# If editing this file, you may also want to update windows/s3_prerelease.cmd

client_dir="$dir/../.."
bucket_name=${BUCKET_NAME:-}
platform=${PLATFORM:-}

if [ "$bucket_name" = "" ]; then
  echo "No BUCKET_NAME"
  exit 1
fi

if [ "$platform" = "" ]; then
  echo "No PLATFORM"
  exit 1
fi

echo "Loading release tool"
"$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$GOPATH/bin/release"

echo "Creating index files"
"$release_bin" index-html --bucket-name="$bucket_name" --prefixes="darwin/,linux_binaries/deb/,linux_binaries/rpm/,windows/" --upload="index.html"
"$release_bin" index-html --bucket-name="$bucket_name" --prefixes="electron-sourcemaps/" --upload="electron-sourcemaps/index.html"

echo "Linking latest ($platform)"
"$release_bin" latest --bucket-name="$bucket_name" --platform="$platform"

echo "Checking if we need to promote a release for testing ($platform)"
"$release_bin" promote-test-releases --bucket-name="$bucket_name" --platform="$platform"

echo "Checking if we need to promote a release ($platform)"
"$release_bin" promote-releases --bucket-name="$bucket_name" --platform="$platform"
