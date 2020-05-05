#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

GOMOBILE_VERSION="4c31acba000778d337c0e4f32091cc923b3363d2"

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

arg=${1:-}

if [[ "$arg" != "ios" && "$arg" != "android" ]]; then
  echo "Nothing to build, you need to specify 'ios' or 'android'"
  exit 1
fi

# For CI, this is run like
#
#  env KEYBASE_BUILD=ci DEST_DIR=/tmp ... /path/to/gobuild.sh android|ios
#
# so make sure doing so doesn't assume anything about where this file is.

# If KEYBASE_BUILD is set and non-empty (e.g., for CI), use it.
if [[ -n ${KEYBASE_BUILD+x} && "$KEYBASE_BUILD" ]]; then
    keybase_build="$KEYBASE_BUILD"
else
    ## TODO(mm) consolidate this with packaging/prerelease/
    current_date=`date -u +%Y%m%d%H%M%S` # UTC
    commit_short=`git log -1 --pretty=format:%h`
    keybase_build="$current_date+$commit_short"
fi

check_ci=${CHECK_CI:-}

IFS=: read -a GOPATH_ARRAY <<< "$GOPATH"
GOPATH0=${GOPATH_ARRAY[0]}

# Original sources
client_dir="$GOPATH0/src/github.com/keybase/client"

echo "Using GOPATH: $GOPATH"

# gomobile looks for gobind in $PATH, so put $GOPATH/bin in $PATH. We
# also want executables from our own GOPATH to override anything
# already in $PATH (like the old GOPATH), so put $GOPATH/bin first.
PATH="$GOPATH/bin:$PATH"

# need to whitelist some flags we use
export CGO_CFLAGS_ALLOW="-fmodules|-fblocks"

if [ "$check_ci" = "1" ]; then
  "$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
  release wait-ci --repo="client" --commit="$(git -C $client_dir rev-parse HEAD)" --context="continuous-integration/jenkins/branch" --context="ci/circleci"
fi

package="github.com/keybase/client/go/bind"
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=$keybase_build -s -w"

build_gomobile ()
{
  echo "Build gomobile..."
  GO111MODULE=on go get golang.org/x/mobile/cmd/{gomobile,gobind}@$GOMOBILE_VERSION
}

if [ "$arg" = "ios" ]; then
  ios_dir=${DEST_DIR:-"$dir/../ios"}
  ios_dest="$ios_dir/keybase.framework"
  echo "Building for iOS ($ios_dest)..."
  set +e
  OUTPUT="$(gomobile bind -target=ios -tags="ios $tags" -ldflags "$ldflags" -o "$ios_dest" "$package" 2>&1)"
  set -e
  if [[ $OUTPUT == *gomobile* ]]; then
    build_gomobile
    gomobile bind -target=ios -tags="ios $tags" -ldflags "$ldflags" -o "$ios_dest" "$package"
  else
    echo $OUTPUT
  fi
elif [ "$arg" = "android" ]; then
  android_dir=${DEST_DIR:-"$dir/../android/keybaselib"}
  android_dest="$android_dir/keybaselib.aar"
  echo "Building for Android ($android_dest)..."
  set +e
  OUTPUT="$(gomobile bind -target=android -tags="android $tags" -ldflags "$ldflags" -o "$android_dest" "$package" 2>&1)"
  set -e
  if [[ $OUTPUT == *gomobile* ]]; then
    build_gomobile
    gomobile bind -target=android -tags="android $tags" -ldflags "$ldflags" -o "$android_dest" "$package"
  else
    echo $OUTPUT
  fi
else
  # Shouldn't get here.
  echo "Nothing to build, you need to specify 'ios' or 'android'"
  exit 1
fi

# Clean up changes to go.mod
go mod tidy
