#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$dir"
# shellcheck source=packaging/lib.sh
source "$dir/../lib.sh"

build_dir=${BUILD_DIR:-/tmp/keybase}
gopath=${GOPATH:-}
package="github.com/keybase/client/go/updater/service"
dest="$build_dir/updater"
arch=${ARCH:-"amd64"}

src_dir=${UPDATER_DIR:-"$gopath/src/$package"}
cd "$src_dir"

mkdir -p "$build_dir"

echo "------------------ Building updater go ------------------"
echo "Building $build_dir/updater with $(go version) on arch: $arch"
GOARCH="$arch" go build -o "$dest" "$package"
echo "------------------ Building updater go ------------------"

kb_sign_binary "$dest"

if [ ! "$PLATFORM" = "darwin-arm64" ]; then # we can't run the arm64 binary on the amd64 build machine!
	updater_version=$("$build_dir"/updater -version)
	echo "Updater version: $updater_version"
fi
