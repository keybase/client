#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

build_dir="$dir/../build"
rm -rf $build_dir
mkdir -p $build_dir

cd $build_dir

# Copy files from desktop and react-native project here
rsync -av -L ../desktop . --exclude node_modules
rsync -av -L ../react-native/react react-native --exclude node_modules
# Copy icon files
cp $dir/../osx/Install/appdmg/Keybase.icns .

# Copy package.json, which shouldn't include devDepencies, which makes the app
# bundle too large. Also need the main to point one directory up.
cp $dir/package-desktop.json package.json
npm install

# Package the app
electron-packager . Keybase \
  --asar=true \
  --platform=darwin \
  --arch=x64 \
  --version=0.35.1 \
  --app-bundle-id=keybase.Electron \
  --helper-bundle-id=keybase.ElectronHelper \
  --icon=Keybase.icns \
  --app-version=1.0.1 \
  --build-version=1.0.1-50

open Keybase-darwin-x64/
