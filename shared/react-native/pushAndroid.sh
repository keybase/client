#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

IFS=: read -a GOPATH_ARRAY <<< "$GOPATH"
GOPATH0=${GOPATH_ARRAY[0]}

APK_DIR="$GOPATH0/src/github.com/keybase/client/shared/react-native/android/app/build/outputs/apk"
APK_FILENAME="app-debug.apk"

# The exact location of the .apk varies.
echo "Looking for $APK_FILENAME in $APK_DIR..."
APK_PATH="$(find $APK_DIR -name $APK_FILENAME | head -n 1)"
if [ -z "$APK_PATH" ]; then
    echo "Couldn't find $APK_FILENAME"
    exit 1
fi

echo "Found $APK_PATH"

adb push "$APK_PATH" /data/local/tmp/io.keybase.ossifrage.debug
adb shell pm install -t -r "/data/local/tmp/io.keybase.ossifrage.debug"
adb shell am start -n "io.keybase.ossifrage.debug/io.keybase.ossifrage.MainActivity" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER
