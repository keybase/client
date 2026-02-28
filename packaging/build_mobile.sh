#! /usr/bin/env bash

gopath=${GOPATH:-}
client_dir="$gopath/src/github.com/keybase/client"

"$client_dir/packaging/slack/send.sh" "Starting Android build"
"$client_dir/packaging/android/build_and_publish.sh"
"$client_dir/packaging/slack/send.sh" "Starting iOS build"
"$client_dir/packaging/ios/build_and_publish.sh"