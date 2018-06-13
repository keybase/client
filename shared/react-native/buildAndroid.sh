#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

cd $dir/android

./gradlew assembleDebug -x bundleDebugJsAndAssets
