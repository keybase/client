#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

app_name="KeybaseStatus"
plist="$dir/../Status/Info.plist"
APP_NAME=$app_name SCHEME="Status" PLIST="$plist" ./build.sh

build_dest="$dir/build"
open $build_dest
