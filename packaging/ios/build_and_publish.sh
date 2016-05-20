#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

gopath=${GOPATH:-}
rn_dir="$gopath/src/github.com/keybase/client/react-native"
ios_dir="$gopath/src/github.com/keybase/client/react-native/ios"
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
  npm run gobuild-ios
fi

# Build and publish the apk
cd $ios_dir

cleanup() {
  cd $client_dir
  git co .
  pkill -P $rn_packager_pid
}

trap 'cleanup' ERR

RN_DIR="$rn_dir" "$client_dir/packaging/manage_react_native_packager.sh" &
rn_packager_pid=$!


fastlane ios beta
cleanup

"$client_dir/packaging/slack/send.sh" "Finished releasing ios"
