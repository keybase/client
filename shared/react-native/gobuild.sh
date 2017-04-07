#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

arg=${1:-}

local_client=${LOCAL_CLIENT:-"1"}
local_kbfs=${LOCAL_KBFS:-}
skip_gomobile_init=${SKIP_GOMOBILE_INIT:-}
tmp_gopath=${TMP_GOPATH:-"/tmp/go-${arg}"}

# Original sources
client_go_dir="$GOPATH/src/github.com/keybase/client/go"
kbfs_dir="$GOPATH/src/github.com/keybase/kbfs"

# Our custom gopath for iOS build
GOPATH="$tmp_gopath"
echo "Using temp GOPATH: $GOPATH"

# Clear source
echo "Clearing $GOPATH/src"
rm -rf "$GOPATH/src/"/*
mkdir -p "$GOPATH/src/github.com/keybase"

# Copy source
go_client_dir="$GOPATH/src/github.com/keybase/client/go"

if [ ! "$local_client" = "1" ]; then
  echo "Getting client (via git clone)... To use local copy, set LOCAL_CLIENT=1"
  (cd "$GOPATH/src/github.com/keybase"; git clone https://github.com/keybase/client)
  # echo "Getting client (via go get)..."
  # go get -u github.com/keybase/client/go/...
else
  echo "Getting client (using local GOPATH)... To use git master, set LOCAL_CLIENT=0"
  mkdir -p "$go_client_dir"
  cp -R "$client_go_dir"/* "$go_client_dir"
fi

go_kbfs_dir="$GOPATH/src/github.com/keybase/kbfs"

if [ ! "$local_kbfs" = "1" ]; then
  echo "Getting KBFS (via git clone)... To use local copy, set LOCAL_KBFS=1"
  (cd "$GOPATH/src/github.com/keybase"; git clone https://github.com/keybase/kbfs)
  # echo "Getting KBFS (via go get)..."
  # go get -u github.com/keybase/kbfs/...
else
  # For testing local KBFS changes
  echo "Getting KBFS (using local GOPATH)... To use git master, set LOCAL_KBFS=0"
  mkdir -p "$go_kbfs_dir"
  cp -R "$kbfs_dir"/* "$go_kbfs_dir"
fi

# Move all vendoring up a directory to github.com/keybase/vendor
echo "Re-vendoring..."
mkdir -p "$GOPATH/src/github.com/keybase/vendor"
# Remove client vendored in kbfs
rm -rf "$go_kbfs_dir/vendor/github.com/keybase/client/go"
# Vendoring client over kbfs (ignore time)
rsync -pr --ignore-times "$go_kbfs_dir/vendor" "$GOPATH/src/github.com/keybase"
rsync -pr --ignore-times "$go_client_dir/vendor" "$GOPATH/src/github.com/keybase"
# Remove their vendoring
rm -rf "$go_kbfs_dir/vendor"
rm -rf "$go_client_dir/vendor"

vendor_path="$GOPATH/src/github.com/keybase/vendor"
gomobile_path="$vendor_path/golang.org/x/mobile/cmd/gomobile"

echo "Build gomobile..."
(cd "$gomobile_path" && go build -o "$GOPATH/bin/gomobile")
# The gomobile binary only looks for packages in the GOPATH,
rsync -pr --ignore-times "$vendor_path/" "$GOPATH/src/"

if [ ! "$skip_gomobile_init" = "1" ]; then
  echo "Doing gomobile init (to skip, set SKIP_GOMOBILE_INIT=1)"
  "$GOPATH/bin/gomobile" init 
fi


package="github.com/keybase/client/go/bind"

## TODO(mm) consolidate this with packaging/prerelease/
current_date=`date -u +%Y%m%d%H%M%S` # UTC
commit_short=`git log -1 --pretty=format:%h`
build="$current_date+$commit_short"
keybase_build=${KEYBASE_BUILD:-$build}
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=$keybase_build"

if [ "$arg" = "ios" ]; then
  ios_dest="$dir/ios/keybase.framework"
  echo "Building for iOS ($ios_dest)..."
  "$GOPATH/bin/gomobile" bind -target=ios -tags="ios" -x -ldflags "$ldflags" -o "$ios_dest" "$package"
elif [ "$arg" = "android" ]; then
  android_dest="$dir/android/keybaselib/keybaselib.aar"
  echo "Building for Android ($android_dest)"
  "$GOPATH/bin/gomobile" bind -target=android -tags="android" -ldflags "$ldflags" -o "$android_dest" "$package"
else
  echo "Nothing to build, you need to specify 'ios' or 'android'"
fi
