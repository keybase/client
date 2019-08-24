#!/usr/bin/env bash

set -eE -u -o pipefail # Fail on error, call ERR trap

automated_build=${AUTOMATED_BUILD:-}
gopath=${GOPATH:-}
kbfs_dir="$gopath/src/github.com/keybase/client/go/kbfs"
client_dir="$gopath/src/github.com/keybase/client"
shared_dir="$gopath/src/github.com/keybase/client/shared"
ios_dir="$gopath/src/github.com/keybase/client/shared/ios"
clean=${CLEAN:-}
cache_npm=${CACHE_NPM:-}
cache_go_lib=${CACHE_GO_LIB:-}
client_commit=${CLIENT_COMMIT:-}
kbfs_commit=${KBFS_COMMIT:-}
check_ci=${CHECK_CI:-1}

# Notify Slack on failure
function notify_slack {
  if [ -n "$automated_build" ]; then
    "$client_dir/packaging/slack/send.sh" "<@channel> Automated iOS build failed, please check out the log."
  fi
}
trap notify_slack ERR

# Reset on exit
kbfs_branch=`cd "$kbfs_dir" && git rev-parse --abbrev-ref HEAD`
client_branch=`cd "$client_dir" && git rev-parse --abbrev-ref HEAD`
rn_packager_pid=""
function reset {
  (cd "$kbfs_dir" && git checkout $kbfs_branch)
  (cd "$client_dir" && git checkout $client_branch)
  (cd "$client_dir" && git checkout shared/ios/)

  if [ ! "$rn_packager_pid" = "" ]; then
    echo "Killing packager $rn_packager_pid"
    pkill -P $rn_packager_pid || true
  fi
}
trap reset EXIT

if [ -n "$kbfs_commit" ]; then
  cd "$kbfs_dir"
  echo "Checking out $kbfs_commit on kbfs (will reset to $kbfs_branch)"
  git fetch
  git clean -f
  git checkout "$kbfs_commit"
  # tell gobuild.sh (called via "yarn run rn-gobuild-ios" below) to use our local commit
  export LOCAL_KBFS=1
fi

cd "$kbfs_dir"
echo "Recent KBFS commit log"
git log -n 3

if [ -n "$client_commit" ]; then
  cd "$client_dir"
  echo "Checking out $client_commit on client (will reset to $client_branch)"
  git fetch
  git clean -f
  git checkout "$client_commit"
else
  "$client_dir/packaging/check_status_and_pull.sh" "$client_dir"
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
  CHECK_CI="$check_ci" yarn run rn-gobuild-ios
fi

"$client_dir/packaging/manage_react_native_packager.sh" &
rn_packager_pid=$!
echo "Packager running with PID $rn_packager_pid"

# Build and publish the apk
cd "$ios_dir"
if [ -n "$clean" ]; then
    xcodebuild clean -workspace "Keybase.xcworkspace" -scheme "Keybase"
fi

# fastlane wants these set
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
fastlane ios beta

"$client_dir/packaging/slack/send.sh" "Finished releasing ios"
