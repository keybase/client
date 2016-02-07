#! /usr/bin/env bash

# This script is for users who want make staging builds from source. See
# https://keybase.io/docs/client/client_architecture. We don't use it
# internally.

set -e -u -o pipefail

cd "$(dirname "$BASH_SOURCE")"

# Always start fresh. Keeps things simple.
build_dir="$(mktemp -d)"
echo "Building in: $build_dir"

# Assemble the local GOPATH.
export GOPATH="$build_dir"
export GO15VENDOREXPERIMENT=1
mkdir -p "$GOPATH/src/github.com/keybase"

# Link in the client repo.
ln -s "$(cd .. ; pwd)" "$GOPATH/src/github.com/keybase/client"

# Build the staging binary.
echo Building kbstage...
go build -a -tags staging -o "$build_dir/kbstage" github.com/keybase/client/go/keybase
