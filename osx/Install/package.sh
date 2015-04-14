#!/bin/sh

set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

if [ ! -d "Keybase.app" ]; then
	echo "You need to Export an archived build from Xcode (Keybase.app)"
	exit 1
fi

if [ ! -f "keybased" ]; then
	echo "You need to build the keybase binaries (build.sh)"
	exit 1
fi

# Clean up
rm -rf Keybase.dmg

VERSION=`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" Keybase.app/Contents/Info.plist`
echo "App Version: $VERSION"

KB_BIN_VERSION=`./keybased --version`
echo "Keybased Version: $KB_BIN_VERSION"

KB_VERSION=`/usr/libexec/PlistBuddy -c "Print :KBKeybasedVersion" Keybase.app/Contents/Info.plist`
echo "Keybased Info Version : $KB_VERSION"

echo "Copying keybase binaries into Keybase.app..."
chmod +x keybased
cp keybased Keybase.app/Contents/MacOS/
chmod +x keybase
mkdir -p Keybase.app/Contents/SharedSupport/bin
cp keybase Keybase.app/Contents/SharedSupport/bin

# Verify
#codesign --verify --verbose=4 Keybase.app

echo "Resigning..."
# Re-sign since we copied in keybased
codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." Keybase.app

rm -rf Keybase-$VERSION.dmg

appdmg appdmg.json Keybase-$VERSION.dmg

#open Keybase-$VERSION.dmg

echo "Installing to /Applications"
rm -rf /Applications/Keybase.app
cp -R Keybase.app /Applications

