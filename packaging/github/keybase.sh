#!/usr/bin/env bash

# This creates a Keybase release on github from the current source/tagged version.

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

version=${VERSION:-}
token=${GITHUB_TOKEN:-}
arch=${ARCH:-"amd64"}

if [ "$version" = "" ]; then
  echo "Specify VERSION to build"
  exit 1
fi

if [ "$token" = "" ]; then
  echo "No GITHUB_TOKEN set. See https://help.github.com/articles/creating-an-access-token-for-command-line-use/"
  exit 2
fi

build_dir="/tmp/build_keybase"
client_dir="$dir../../client"
tag="v$version"
tgz="keybase-$version.tgz"

echo "Loading release tool"
(cd "$client_dir/go" && go install "github.com/keybase/release")
release_bin="$GOPATH/bin/release"
echo "$(go version)"

build() {
  rm -rf "$build_dir"
  mkdir -p "$build_dir"
  cd "$build_dir"

  echo "Downloading source archive"
  src_url="https://github.com/keybase/client/archive/v$version.tar.gz"
  curl -O -J -L "$src_url"

  src_tgz="client-$version.tar.gz"
  echo "Unpacking $src_tgz"
  tar zxpf "$src_tgz"
  rm "$src_tgz"

  go_dir=/tmp/go
  rm -rf "$go_dir"
  mkdir -p "$go_dir/src/github.com/keybase"
  mv "client-$version" "$go_dir/src/github.com/keybase/client"

  echo "Building keybase"
  (cd "$client_dir"/go GOPATH="$go_dir" && GOARCH="$arch" go build -a -tags "production" -o keybase github.com/keybase/client/go/keybase)

  echo "Packaging"
  rm -rf "$tgz"
  tar zcpf "$tgz" keybase
}

create_release() {
  echo "Checking for existing release: $version"
  api_url=$($release_bin url --user=keybase --repo=client --version="$version")
  if [ ! "$api_url" = "" ]; then
    echo "Release already exists, skipping"
  else
    cd "$build_dir"
    echo "Creating release"
    "$release_bin" create --version="$version" --repo="client"
  fi
}

upload_release() {
  cd "$build_dir"
  platform=$($release_bin platform)
  if [ "$platform" = "darwin" ] && [ "$arch" = "arm64" ]; then
    platform="$platform-$arch"
  fi
  echo "Uploading release"
  "$release_bin" upload --src="$tgz" --dest="keybase-$version-$platform.tgz" --version="$version" --repo="client"
}

build
create_release
upload_release
