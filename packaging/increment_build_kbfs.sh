#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

#KBVERSION="1.0.0-31"
./increment_build.sh "$GOPATH/src/github.com/keybase/kbfs/" "$GOPATH/src/github.com/keybase/kbfs/libkbfs/version.go" "kbfs" "libkbfs" $@
