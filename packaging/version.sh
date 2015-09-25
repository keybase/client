#! /bin/bash

# Parse the version number out of our codebase and print it. This script exists
# because our packaging process needs the version number in a lot of places,
# and not all of those have access to the built binary to run
# `keybase version --format=s`.

set -e -u -o pipefail

version_file="$(dirname "$BASH_SOURCE")/../go/libkb/version.go"

version="$(cat "$version_file" | grep 'Version =' | grep -oE '[0-9]+(.[0-9]+)+')"

build_number="$(cat "$version_file" | grep 'Build =' | grep -oE '[0-9]+')"

echo "$version-$build_number"
