#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

./increment_build.sh "$GOPATH/src/github.com/keybase/client/" "$GOPATH/src/github.com/keybase/client/go/libkb/version.go" "client" "libkb" $@
