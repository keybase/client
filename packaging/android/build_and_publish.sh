#!/usr/bin/env bash

set -eE -u -o pipefail # Fail on error, call ERR trap

automated_build=${AUTOMATED_BUILD:-}
gopath=${GOPATH:-}
kbfs_dir="$gopath/src/github.com/keybase/client/go/kbfs"
client_dir="$gopath/src/github.com/keybase/client"
shared_dir="$gopath/src/github.com/keybase/client/shared"
rn_dir="$gopath/src/github.com/keybase/client/shared/react-native"
android_dir="$gopath/src/github.com/keybase/client/shared/android"
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
client_branch=`cd "$client_dir" && git rev-parse --abbrev-ref HEAD`
rn_packager_pid=""
function reset {
  (cd "$client_dir" && git checkout $client_branch)

  if [ ! "$rn_packager_pid" = "" ]; then
    echo "Killing packager $rn_packager_pid"
    pkill -P $rn_packager_pid || true
  fi
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

if [ ! "$cache_npm" = "1" ]; then
  echo "Cleaning up main node_modules from previous runs"
  rm -rf "$shared_dir/node_modules"

  yarn install --frozen-lockfile --prefer-offline
  yarn global add react-native-cli
fi


if [ ! "$cache_go_lib" = "1" ]; then
  echo "Building Go library"
  CHECK_CI="$check_ci" yarn run rn-gobuild-android
fi

# We can't currently automate this :(, we used to be able to `echo y | android update ...` but that no longer works
# android update sdk --all --no-ui --filter "build-tools-23.0.2,android-23,extra-android-support,extra-android-m2repository"

"$client_dir/packaging/manage_react_native_packager.sh" &
rn_packager_pid=$!
echo "Packager running with PID $rn_packager_pid"

# Build and publish the apk
cd "$android_dir"
./gradlew clean
./gradlew publishReleaseBundle

"$client_dir/packaging/slack/send.sh" "Finished releasing android"

echo "Done"
