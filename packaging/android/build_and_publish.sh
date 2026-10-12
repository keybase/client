#!/usr/bin/env bash

set -eE -u -o pipefail # Fail on error, call ERR trap

automated_build=${AUTOMATED_BUILD:-}
dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
client_dir="$dir/../.."
# shellcheck source=packaging/lib.sh
source "$dir/../lib.sh"
shared_dir="$client_dir/shared"
android_dir="$shared_dir/android"
cache_npm=${CACHE_NPM:-}
cache_go_lib=${CACHE_GO_LIB:-}
client_commit=${CLIENT_COMMIT:-}
check_ci=${CHECK_CI:-1}

# Notify Slack on failure
function notify_slack {
	if [ -n "$automated_build" ]; then
		"$client_dir/packaging/slack/send.sh" "<@channel> Automated Android build failed, please check out the log."
	fi
}
trap notify_slack ERR

"$client_dir/packaging/check_status_and_pull.sh" "$client_dir"

# Reset on exit
client_branch=$(cd "$client_dir" && git rev-parse --abbrev-ref HEAD)
function reset {
	(cd "$client_dir" && git checkout "$client_branch")
}
trap reset EXIT

if [ -n "$client_commit" ]; then
	cd "$client_dir"
	echo "Checking out $client_commit on client (will reset to $client_branch)"
	git fetch
	git checkout "$client_commit"
fi

cd "$client_dir"
echo "Recent client commit log"
git log -n 3

cd "$shared_dir"

kb_prune_yarn_cache

if [ ! "$cache_npm" = "1" ]; then
	kb_yarn_modules "$shared_dir"
fi

if [ ! "$cache_go_lib" = "1" ]; then
	echo "Building Go library"
	CHECK_CI="$check_ci" yarn run android:gobuild
fi

# We can't currently automate this :(, we used to be able to `echo y | android update ...` but that no longer works
# android update sdk --all --no-ui --filter "build-tools-23.0.2,android-23,extra-android-support,extra-android-m2repository"

# Build and publish the apk
cd "$android_dir"
rm -rf app/.cxx
# node_modules is kept between builds now, so drop the native modules' CMake
# caches too; they pin NDK and prefab paths.
find "$shared_dir/node_modules" -type d -path '*/android/.cxx' -prune -exec rm -rf {} +
rm -rf app/build
./gradlew clean
# yarn jetify
./gradlew publishReleaseBundle

"$client_dir/packaging/slack/send.sh" "Finished releasing android"

echo "Done"
