#! /usr/bin/env bash

gopath=${GOPATH:-}
client_dir="$gopath/src/github.com/keybase/client"

echo "Cleaning yarn cache to free up disk space"
yarn cache clean

if [[ -n "${ARCH:-}" ]]; then
  # If ARCH is specified, only build that one
  if [[ "$ARCH" == "amd64" ]]; then
    "$client_dir/packaging/slack/send.sh" "Starting darwin build"
    ARCH="amd64" PLATFORM="darwin" "$client_dir/packaging/prerelease/pull_build.sh"
  elif [[ "$ARCH" == "arm64" ]]; then
    "$client_dir/packaging/slack/send.sh" "Starting darwin-arm64 build"
    ARCH="arm64" PLATFORM="darwin-arm64" "$client_dir/packaging/prerelease/pull_build.sh"
  else
    echo "Unknown ARCH: $ARCH (expected amd64 or arm64)"
    exit 1
  fi
else
  # Build both architectures
  "$client_dir/packaging/slack/send.sh" "Starting darwin build"
  ARCH="amd64" PLATFORM="darwin" "$client_dir/packaging/prerelease/pull_build.sh"

  # Clean repo between arch builds
  echo "Cleaning repo..."
  cd "$client_dir" && git reset --hard && git clean -fd
  git status

  # NOTE: We build the arm64 version second to get a later timestamp, so it will
  # be presented as a later version to your updater. This allows the one-time
  # upgrading from the x86 build to the arm64 one.
  "$client_dir/packaging/slack/send.sh" "Starting darwin-arm64 build"
  ARCH="arm64" PLATFORM="darwin-arm64" "$client_dir/packaging/prerelease/pull_build.sh"
fi
