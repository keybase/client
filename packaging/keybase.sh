#!/bin/bash

# This creates a Keybase release on github from the current source/tagged version.

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir="/tmp/build_keybase"

clientdir="$GOPATH/src/github.com/keybase/client"

echo "Loading release tool"
go install github.com/keybase/client/go/tools/release
release_bin="$GOPATH/bin/release"

version=`$release_bin version`
tag="v$version"
tgz="keybase-$version.tgz"
token="${GITHUB_TOKEN:-}"

if [ "$token" = "" ]; then
  echo "No GITHUB_TOKEN set. See https://help.github.com/articles/creating-an-access-token-for-command-line-use/"
  exit 2
fi

check_release() {
  echo "Checking for existing release: $version"
  api_url=`$release_bin url`
  if [ ! "$api_url" = "" ]; then
    echo "Release already exists"
    exit 0
  fi
}

build() {
  rm -rf "$build_dir"
  mkdir -p "$build_dir"
  cd "$build_dir"

  echo "Downloading source archive"
  src_url="https://github.com/keybase/client/archive/v$version.tar.gz"
  curl -O -J -L $src_url

  src_tgz="client-$version.tar.gz"
  echo "Unpacking $src_tgz"
  tar zxpf "$src_tgz"
  rm "$src_tgz"

  go_dir=/tmp/go
  rm -rf "$go_dir"
  mkdir -p "$go_dir/src/github.com/keybase"
  mv "client-$version" "$go_dir/src/github.com/keybase/client"

  echo "Building keybase"
  GO15VENDOREXPERIMENT=1 GOPATH=$go_dir go build -a -tags "production" -o keybase github.com/keybase/client/go/keybase

  echo "Checking version"
  version_build=`GO15VENDOREXPERIMENT=1 go run $go_dir/src/github.com/keybase/client/go/tools/release/release.go version`
  echo "Version build: $version_build"
  if [ "$version" = "$version_build" ]; then
    echo "Version mismatch: $version != $version_build"
    exit 2
  fi

  echo "Packaging"
  rm -rf "$tgz"
  tar zcpf "$tgz" keybase
}

create_release() {
  cd "$build_dir"
  echo "Creating release"
  $release_bin create
  echo "Uploading release"
  $release_bin --file="$tgz" upload
}

check_release
build
create_release
