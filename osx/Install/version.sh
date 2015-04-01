#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

VERSION=`git describe --abbrev=0`
echo "Version: $VERSION"

KB_BIN_VERSION=`./keybased --version`
KB_VERSION="${KB_BIN_VERSION##* }"
echo "Keybased Version: $KB_VERSION"

PLIST=$DIR/../Keybase/Info.plist

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBKeybasedVersion '${KB_VERSION}'" $PLIST
