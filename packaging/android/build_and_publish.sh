#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

gopath=${GOPATH:-}
rn_dir="$gopath/src/github.com/keybase/client/react-native"
android_dir="$gopath/src/github.com/keybase/client/react-native/android"
client_dir="$gopath/src/github.com/keybase/client"
cache_npm=${CACHE_NPM:-}
cache_go_lib=${CACHE_GO_LIB:-}

"$client_dir/packaging/check_status_and_pull.sh" "$client_dir"

cd $rn_dir

if [ ! "$cache_npm" = "1" ]; then
  ../packaging/npm_mess.sh
  npm install -g react-native-cli
fi


if [ ! "$cache_go_lib" = "1" ]; then
  echo "Building Go library"
  npm run gobuild-android
fi

# We can't currently automate this :(, we used to be able to `echo y | android update ...` but that no longer works
# android update sdk --all --no-ui --filter "build-tools-23.0.2,android-23,extra-android-support,extra-android-m2repository"

# Build and publish the apk
cd $android_dir

RN_DIR="$rn_dir" $client_dir/packaging/manage_react_native_packager.sh &
rn_packager_pid=$!

cleanup() {
  pkill -P $rn_packager_pid
}

trap 'cleanup' ERR

./gradlew clean
./gradlew publishApkRelease

cleanup

"$client_dir/packaging/slack/send.sh" "Finished releasing android"
