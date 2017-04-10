#!/bin/sh

set -o pipefail && xcodebuild test -scheme Keybase -workspace Keybase.xcworkspace | xcpretty -c
