#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

gopath=${GOPATH:-}
rn_dir="$gopath/src/github.com/keybase/client/react-native"
ios_dir="$gopath/src/github.com/keybase/client/react-native/ios"
client_dir="$gopath/src/github.com/keybase/client"
cache_npm=${CACHE_NPM:-}
cache_go_lib=${CACHE_GO_LIB:-}

cd $rn_dir

if [ ! "$cache_npm" = "1" ]; then
  echo "Clearing old node_modules in react-native"
  npm cache clean
  rm -r node_modules || true
  # Install npm
  npm install
  npm install -g react-native-cli
fi


if [ ! "$cache_go_lib" = "1" ]; then
  echo "Building Go library"
  npm run gobuild-ios
fi

# Build and publish the apk
cd $ios_dir

fastlane ios beta

"$client_dir/packaging/slack/send.sh" "Finished releasing ios"
