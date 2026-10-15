#! /usr/bin/env bash

set -eEuo pipefail

gopath=${GOPATH:-}
client_dir="$gopath/src/github.com/keybase/client"

step="setup"
notify_failure() {
  "$client_dir/packaging/slack/send.sh" "build_darwin.sh stopped: $step failed" || true
}
trap notify_failure ERR

# shellcheck source=packaging/lib.sh
source "$client_dir/packaging/lib.sh"
kb_prune_yarn_cache

arch=${ARCH:-}
if [[ -n "$arch" ]]; then
  # If ARCH is specified, only build that one
  if [[ "$arch" == "amd64" ]]; then
    step="darwin build"
    "$client_dir/packaging/slack/send.sh" "Starting darwin build" || true
    ARCH="amd64" PLATFORM="darwin" "$client_dir/packaging/prerelease/pull_build.sh"
  elif [[ "$arch" == "arm64" ]]; then
    step="darwin-arm64 build"
    "$client_dir/packaging/slack/send.sh" "Starting darwin-arm64 build" || true
    ARCH="arm64" PLATFORM="darwin-arm64" "$client_dir/packaging/prerelease/pull_build.sh"
  else
    "$client_dir/packaging/slack/send.sh" "build_darwin.sh stopped: unknown ARCH $arch (expected amd64 or arm64)" || true
    exit 1
  fi
else
  # Build both architectures
  step="darwin build"
  "$client_dir/packaging/slack/send.sh" "Starting darwin build" || true
  ARCH="amd64" PLATFORM="darwin" "$client_dir/packaging/prerelease/pull_build.sh"

  # Clean repo between arch builds
  step="repo cleanup between darwin builds"
  echo "Cleaning repo..."
  cd "$client_dir"
  git reset --hard
  git clean -fd
  git status

  # NOTE: We build the arm64 version second to get a later timestamp, so it will
  # be presented as a later version to your updater. This allows the one-time
  # upgrading from the x86 build to the arm64 one.
  step="darwin-arm64 build"
  "$client_dir/packaging/slack/send.sh" "Starting darwin-arm64 build" || true
  ARCH="arm64" PLATFORM="darwin-arm64" "$client_dir/packaging/prerelease/pull_build.sh"
fi
