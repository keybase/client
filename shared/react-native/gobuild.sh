#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
client_dir="$dir/../.."
cd "$client_dir/go"

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

GOPATH=${GOPATH:-$(go env GOPATH)}
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

# KB_GO_DEBUG=1 builds the Go side with its pointer-safety checks on, for
# running the app under the Xcode ASan/TSan schemes.
#
# This is as far as instrumenting Go goes on mobile: -race, -asan and -msan are
# all unsupported on ios/arm64 and darwin/arm64, which is exactly why a C++
# sanitizer cannot see the Go runtime and shared/ios/tsan-suppressions.txt has
# to exist. What is left still covers the interesting hazard here -- Go pointers
# reaching C and outliving the call that passed them:
#
#   cgocheck2  every cgo pointer-passing rule, not just the cheap subset the
#              default cgocheck applies. Catches a Go pointer stored into C
#              memory, which is the failure mode WriteArr's defensive copy and
#              ReadArr's copy-out both exist to prevent.
#   checkptr   validates unsafe.Pointer arithmetic and alignment. Normally
#              implied by -race; enabled here by hand since -race is unavailable.
#
# Expect a slower build and slower runtime. Violations panic with a stack, so
# they land in the device log rather than in the sanitizer's report.
gcflags=""
if [[ -n ${KB_GO_DEBUG:-} && "${KB_GO_DEBUG}" != "0" ]]; then
	echo "KB_GO_DEBUG: building with cgocheck2 + checkptr"
	export GOEXPERIMENT="${GOEXPERIMENT:+$GOEXPERIMENT,}cgocheck2"
	gcflags="all=-d=checkptr"
	# The symbol table is what turns a violation's stack into something
	# readable, and -s -w discards it.
	#
	# The +godebug suffix rides along in the build version so the variant is
	# identifiable after the fact -- it shows up wherever PrereleaseBuild is
	# logged or displayed. The artifact keeps its normal filename (the Xcode
	# link phase and the podspec header search paths both hardcode
	# keybasego.xcframework), so this string is the thing that tells you which
	# variant is actually installed.
	ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=$keybase_build+godebug"
fi

# gomobile shells out to `gobind` found in $PATH; install the go.mod-pinned
# version. (Do not use `gomobile init` for this — it installs gobind@latest,
# which can skew against the x/mobile version pinned in go.mod.)
go install golang.org/x/mobile/cmd/gobind

if [ "$arg" = "ios" ]; then
	ios_dir=${DEST_DIR:-"$client_dir/shared/ios"}
	ios_dest="$ios_dir/keybasego.xcframework"
	# Keep in sync with IPHONEOS_DEPLOYMENT_TARGET
	ios_version="15.1"
	echo "Building for iOS ($ios_dest)..."
	go tool gomobile bind -target=ios -iosversion="$ios_version" -tags="ios $tags" -trimpath ${gcflags:+-gcflags="$gcflags"} -ldflags "$ldflags" -o "$ios_dest" "$package"
	# gobind emits `@import Foundation;` which breaks ObjC++ consumers (Kb.mm); rewrite to a plain include
	find "$ios_dest" -name '*.objc.h' -exec sed -i '' 's/@import Foundation;/#include <Foundation\/Foundation.h>/' {} +
elif [ "$arg" = "android" ]; then
	android_dir=${DEST_DIR:-"$client_dir/shared/android/keybaselib"}
	android_dest="$android_dir/keybaselib.aar"
	android_api="23"
	# support 16kb page sizes on this ndk
	android_ldflags="$ldflags \"-extldflags=-Wl,-z,max-page-size=16384\""
	# No 32-bit x86: dead hardware, and emulator images are x86_64/arm64.
	# Keep in sync with reactNativeArchitectures in shared/android/gradle.properties.
	# Override for faster local iteration, e.g. TARGETS=android/arm64.
	android_targets=${TARGETS:-"android/arm,android/arm64,android/amd64"}
	echo "Building for Android ($android_dest)..."
	go tool gomobile bind -target="$android_targets" -androidapi "$android_api" -tags="android $tags" -trimpath ${gcflags:+-gcflags="$gcflags"} -ldflags "$android_ldflags" -o "$android_dest" "$package"
else
	# Shouldn't get here.
	echo "Nothing to build, you need to specify 'ios' or 'android'"
	exit 1
fi
