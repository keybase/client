#! /usr/bin/env bash

gopath=${GOPATH:-}
client_dir="$gopath/src/github.com/keybase/client"

"$client_dir/packaging/slack/send.sh" "Starting darwin build"
ARCH="amd64" PLATFORM="darwin" "$client_dir/packaging/prerelease/pull_build.sh"
"$client_dir/packaging/slack/send.sh" "Starting darwin-arm64 build"
ARCH="arm64" PLATFORM="darwin-arm64" "$client_dir/packaging/prerelease/pull_build.sh"
