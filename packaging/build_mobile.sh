#! /usr/bin/env bash

set -eEuo pipefail

gopath=${GOPATH:-}
client_dir="$gopath/src/github.com/keybase/client"

step="setup"
notify_failure() {
  "$client_dir/packaging/notify/send.sh" "build_mobile.sh stopped: $step failed" || true
}
trap notify_failure ERR

step="Android build"
"$client_dir/packaging/notify/send.sh" "Starting Android build" || true
"$client_dir/packaging/android/build_and_publish.sh"
step="iOS build"
"$client_dir/packaging/notify/send.sh" "Starting iOS build" || true
"$client_dir/packaging/ios/build_and_publish.sh"
