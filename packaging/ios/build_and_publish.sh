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
  rm -r $TMPDIR/npm*
  rm -r node_modules || true
  npm cache clean
  npm install
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
}

err_cleanup() {
  cleanup
}

trap 'err_cleanup' ERR

fastlane ios beta
cleanup

"$client_dir/packaging/slack/send.sh" "Finished releasing ios"
