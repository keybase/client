#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

app_name="KeybaseInstaller"
plist="$dir/../Installer/Info.plist"
APP_NAME=$app_name SCHEME="Installer" PLIST="$plist" ./build.sh

if [ "$COPY_INTO_BUNDLE" = "1" ]; then
  dest="/Applications/Keybase.app/Contents/Resources/$app_name.app"
  echo "Copying into bundle $dest"
  rm -rf "$dest"
  ditto "$dir/build/$app_name.app" "$dest"
fi
