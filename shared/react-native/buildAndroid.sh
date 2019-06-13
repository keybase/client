#!/usr/bin/env bash

IFS=: read -a GOPATH_ARRAY <<< "$GOPATH"
GOPATH0=${GOPATH_ARRAY[0]}

cd $GOPATH0/src/github.com/keybase/client/shared/android
exec ./gradlew assembleDebug -x bundleDebugJsAndAssets --stacktrace
