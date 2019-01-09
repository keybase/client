#!/usr/bin/env bash

# This creates a KBFS release on github from the current source/tagged version.

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

version=${VERSION:-}
token=${GITHUB_TOKEN:-}

if [ "$version" = "" ]; then
  echo "Specify VERSION to build"
  exit 1
fi

if [ "$token" = "" ]; then
  echo "No GITHUB_TOKEN set. See https://help.github.com/articles/creating-an-access-token-for-command-line-use/"
  exit 2
fi

build_dir="/tmp/build_kbfs"
client_dir="$GOPATH/src/github.com/keybase/client"
tag="v$version"
tgz="kbfs-$version.tgz"

echo "Loading release tool"
"$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$GOPATH/bin/release"

build() {
  rm -rf "$build_dir"
  mkdir -p "$build_dir"
  cd "$build_dir"

  echo "Downloading source archive"
  src_url="https://github.com/keybase/client/go/kbfs/archive/v$version.tar.gz"
  curl -O -J -L "$src_url"

  src_tgz="kbfs-$version.tar.gz"
  echo "Unpacking $src_tgz"
  tar zxpf "$src_tgz"
  rm "$src_tgz"

  go_dir=/tmp/go
  rm -rf "$go_dir"
  mkdir -p "$go_dir/src/github.com"
  mv "kbfs-$version" "$go_dir/src/github.com/keybase"

  echo "Building kbfs"
  GO15VENDOREXPERIMENT=1 GOPATH="$go_dir" go build -a -tags "production" -o kbfs github.com/keybase/client/go/kbfs/kbfsfuse

  echo "Packaging"
  rm -rf "$tgz"
  tar zcpf "$tgz" kbfs
}

create_release() {
  echo "Checking for existing release: $version"
  api_url=`$release_bin url --user=keybase --repo=kbfs --version=$version`
  if [ ! "$api_url" = "" ]; then
    echo "Release already exists, skipping"
  else
    cd "$build_dir"
    platform=`$release_bin platform`
    echo "Creating release"
    "$release_bin" create --version="$version" --repo="kbfs"
  fi
}

upload_release() {
  cd "$build_dir"
  platform=`$release_bin platform`
  echo "Uploading release"
  "$release_bin" upload --src="$tgz" --dest="kbfs-$version-$platform.tgz" --version="$version" --repo="kbfs"
}

build
create_release
upload_release
