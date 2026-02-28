#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
client_dir="$dir/../.."
cd $client_dir/go

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
	current_date=$(date -u +%Y%m%d%H%M%S) # UTC
	commit_short=$(git log -1 --pretty=format:%h)
	keybase_build="$current_date+$commit_short"
fi

check_ci=${CHECK_CI:-}

echo "Using GOPATH: $GOPATH"
echo "Using go version: $(go version)"

# gomobile looks for gobind in $PATH, so put $GOPATH/bin in $PATH. We
# also want executables from our own GOPATH to override anything
# already in $PATH (like the old GOPATH), so put $GOPATH/bin first.
PATH="$GOPATH/bin:$PATH"

# need to allowlist some flags we use
export CGO_CFLAGS_ALLOW="-fmodules|-fblocks"

if [ "$check_ci" = "1" ]; then
	(
		cd "$client_dir/go/buildtools"
		go install "github.com/keybase/client/go/release"
	)
	release wait-ci --repo="client" --commit="$(git rev-parse HEAD)" --context="continuous-integration/jenkins/branch" --context="ci/circleci"
fi

package="github.com/keybase/client/go/bind"
tags=${TAGS:-"prerelease production"}
ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=$keybase_build -s -w"

build_gomobile() {
	echo "Build gomobile..."
	(go install golang.org/x/mobile/cmd/{gomobile,gobind} && go tool gomobile init)
}

if [ "$arg" = "ios" ]; then
	ios_dir=${DEST_DIR:-"$client_dir/shared/ios"}
	ios_dest="$ios_dir/keybasego.xcframework"
	# Keep in sync with IPHONEOS_DEPLOYMENT_TARGET
	ios_version="15.1"
	echo "Building for iOS ($ios_dest)..."
	set +e
	OUTPUT="$(go tool gomobile bind -target=ios -iosversion="$ios_version" -tags="ios $tags" -ldflags "$ldflags" -o "$ios_dest" "$package" 2>&1)"
	set -e
	if [[ $OUTPUT == *gomobile* ]]; then
		build_gomobile
		go tool gomobile bind -target=ios -iosversion="$ios_version" -tags="ios $tags" -ldflags "$ldflags" -o "$ios_dest" "$package"
	else
		echo $OUTPUT
	fi
elif [ "$arg" = "android" ]; then
	android_dir=${DEST_DIR:-"$client_dir/shared/android/keybaselib"}
	android_dest="$android_dir/keybaselib.aar"
	android_api="23"
	# support 16kb page sizes on this ndk
	android_ldflags="$ldflags \"-extldflags=-Wl,-z,max-page-size=16384\""
	echo "Building for Android ($android_dest)..."
	set +e
	OUTPUT="$(go tool gomobile bind -target=android -androidapi "$android_api" -tags="android $tags" -ldflags "$android_ldflags" -o "$android_dest" "$package" 2>&1)"
	set -e
	if [[ $OUTPUT == *gomobile* ]]; then
		build_gomobile
		go tool gomobile bind -target=android -androidapi "$android_api" -tags="android $tags" -ldflags "$android_ldflags" -o "$android_dest" "$package"
	else
		echo $OUTPUT
	fi
else
	# Shouldn't get here.
	echo "Nothing to build, you need to specify 'ios' or 'android'"
	exit 1
fi

# tidy indirect reference to gomobile
go mod tidy
