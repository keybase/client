#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

app_name="KeybaseInstaller"
plist="$dir/../Installer/Info.plist"
helper="$app_name.app/Contents/Library/LaunchServices/keybase.Helper"
APP_NAME=$app_name SCHEME="Installer" PLIST="$plist" HELPER="$helper" ./build.sh

build_dest="$dir/build"
open $build_dest
