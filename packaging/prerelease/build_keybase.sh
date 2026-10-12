#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$dir"
client_dir="$dir/../../go"
# shellcheck source=packaging/lib.sh
source "$dir/../lib.sh"

build_dir=${BUILD_DIR:-/tmp/keybase}

mkdir -p "$build_dir"

keybase_build=${KEYBASE_BUILD:-$(kb_build_id)}
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=$keybase_build -s -w"
arch=${ARCH:-"amd64"}

echo "------------------ Building go ------------------"
echo "Building $build_dir/keybase ($keybase_build) with $(go version) on arch: $arch"
(cd "$client_dir" && GOARCH="$arch" go build -tags "$tags" -ldflags "$ldflags" -o "$build_dir/keybase" "github.com/keybase/client/go/keybase")
echo "------------------ Building go ------------------"

kb_sign_binary "$build_dir/keybase"

if [ ! "$PLATFORM" = "darwin-arm64" ]; then # we can't run the arm64 binary on the amd64 build machine!
	version=$("$build_dir"/keybase version -S)
	echo "Keybase version: $version"
fi
