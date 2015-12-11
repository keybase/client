#!/bin/bash

# This creates a Keybase release on github from the current source/tagged version.

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir="/tmp/build_kbfs"

echo "Loading release tool"
go install github.com/keybase/client/go/tools/release
release_bin="$GOPATH/bin/release"

version=$VERSION
if [ "$version" = "" ]; then
  version=`$release_bin --repo=kbfs-beta latest-version`
fi
tag="v$version"
tgz="kbfs-$version.tgz"
token="${GITHUB_TOKEN:-}"

if [ "$token" = "" ]; then
  echo "No GITHUB_TOKEN set. See https://help.github.com/articles/creating-an-access-token-for-command-line-use/"
  exit 2
fi

check_release() {
  echo "Checking for existing release: $version"
  api_url=`$release_bin --repo=kbfs-beta --version=$version url`
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
  src_url="https://github.com/keybase/kbfs-beta/archive/v$version.tar.gz"
  curl -O -J -L $src_url

  src_tgz="kbfs-beta-$version.tar.gz"
  echo "Unpacking $src_tgz"
  tar zxpf "$src_tgz"
  rm "$src_tgz"

  go_dir=/tmp/go
  rm -rf "$go_dir"
  mkdir -p "$go_dir/src/github.com"
  mv "kbfs-beta-$version" "$go_dir/src/github.com/keybase"

  echo "Building kbfs"
  GO15VENDOREXPERIMENT=0 GOPATH=$go_dir go get github.com/keybase/kbfs/kbfsfuse
  GO15VENDOREXPERIMENT=0 GOPATH=$go_dir go build -a -tags "production" -o kbfs github.com/keybase/kbfs/kbfsfuse

  echo "Packaging"
  rm -rf "$tgz"
  tar zcpf "$tgz" kbfs
}

create_release() {
  cd "$build_dir"
  osname=`$release_bin os-name`
  echo "Creating release"
  $release_bin -version "$version" -repo "kbfs-beta" create
  echo "Uploading release"
  $release_bin -src "$tgz" -dest "kbfs-$version-$osname.tgz" -version "$version" -repo "kbfs-beta" upload
}

check_release
build
create_release
