#!/usr/bin/env bash

IFS=: read -a GOPATH_ARRAY <<< "$GOPATH"
GOPATH0=${GOPATH_ARRAY[0]}

if [[ $# < 1 ]] || [[ $1 != "debug" ]] && [[ $1 != "storybook" ]]; then
    echo "Usage: buildAndroid.sh <debug|storybook>"
    exit 1
fi

cd $GOPATH0/src/github.com/keybase/client/shared/android
exec ./gradlew "assemble$1" -x bundleDebugJsAndAssets --stacktrace
