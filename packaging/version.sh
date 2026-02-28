#! /usr/bin/env bash

# Parse the version number out of our codebase and print it. This script exists
# because our packaging process needs the version number in a lot of places,
# and not all of those have access to the built binary to run
# `keybase version --format=s`.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
mode="$("$here/build_mode.sh" "$@")"

version_file="$(dirname "$BASH_SOURCE")/../go/libkb/version.go"
version="$(cat "$version_file" | grep 'Version =' | grep -oE '[0-9]+(.[0-9]+)+')"
build=""

if [ ! "$mode" = "production" ] ; then
  current_date="$(date -u +%Y%m%d%H%M%S)" # UTC
  commit_short="$(git -C "$here" log -1 --pretty=format:%h || \
    echo -n "${SOURCE_COMMIT:0:10}")"
  build="-$current_date+$commit_short"
fi

echo "$version$build"
