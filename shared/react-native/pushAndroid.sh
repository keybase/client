#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

IFS=: read -a GOPATH_ARRAY <<< "$GOPATH"
GOPATH0=${GOPATH_ARRAY[0]}

adb push $GOPATH0/src/github.com/keybase/client/shared/react-native/android/app/build/outputs/apk/app-debug.apk /data/local/tmp/io.keybase.ossifrage.debug
adb shell pm install -t -r "/data/local/tmp/io.keybase.ossifrage.debug"
adb shell am start -n "io.keybase.ossifrage.debug/io.keybase.ossifrage.MainActivity" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER
