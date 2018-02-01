#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

xcode_configuration="Release"

set -o pipefail && xcodebuild build -scheme keybase.Helper -workspace $dir/../Keybase.xcworkspace -configuration $xcode_configuration | xcpretty -c
