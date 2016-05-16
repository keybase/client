#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

output="$GOPATH/bin/notifier"
codesignid=${CODESIGNID:-"Developer ID Application: Keybase, Inc. (99229SGT5K)"}

echo "Building"
go build -ldflags "-s" -o "$output" ./notifier
echo "Code signing"
codesign --verbose --force --sign "$codesignid" "$output"

#echo "Checking plist"
#otool -X -s __TEXT __info_plist "$output" | xxd -r

echo "Checking codesign"
codesign --verify --verbose=4 "$output"
