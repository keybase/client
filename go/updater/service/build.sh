#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir=${BUILD_DIR:-/Applications/Keybase.app/Contents/SharedSupport/bin}
dest="$build_dir/updater"

echo "Building go-updater/service to $dest"
GO15VENDOREXPERIMENT=1 go build -a -o "$dest" github.com/keybase/client/go/updater/service
