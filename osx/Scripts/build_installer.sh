#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

app_name="KeybaseInstaller"
plist="$dir/../Installer/Info.plist"
copy_into_bundle=${COPY_INTO_BUNDLE:-}
APP_NAME=$app_name SCHEME="Installer" PLIST="$plist" ./build.sh

if [ "$copy_into_bundle" = "1" ]; then
  dest="/Applications/Keybase.app/Contents/Resources/$app_name.app"
  echo "Copying into bundle $dest"
  rm -rf "$dest"
  ditto "$dir/build/$app_name.app" "$dest"
fi
