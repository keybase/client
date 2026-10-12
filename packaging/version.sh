#! /usr/bin/env bash

# Parse the version number out of our codebase and print it. This script exists
# because our packaging process needs the version number in a lot of places,
# and not all of those have access to the built binary to run
# `keybase version --format=s`.

set -e -u -o pipefail

here="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=packaging/lib.sh
source "$here/lib.sh"
mode="$("$here/build_mode.sh" "$@")"

version="$(kb_lib_version)"
build=""

if [ ! "$mode" = "production" ] ; then
  build="-$(kb_build_id)"
fi

echo "$version$build"
