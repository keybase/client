#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

BUILD_DEST=$DIR/build

if [ "$1" = "" ]; then
  echo "Specify a version."
  exit 1
fi

KB_GO_SRC=$GOPATH/src/github.com/keybase/client/go
VERSION="$1"
CODE_SIGN_IDENTITY="Developer ID Application: Keybase, Inc. (99229SGT5K)"


echo "Using keybase source: $KB_GO_SRC"
echo "Using version: $VERSION"
echo " "

if [ -d "$BUILD_DEST" ]; then
  echo "Build directory already exists: $BUILD_DEST"
  echo " "
  echo "You probably want to remove it and try this again."
  exit 1
fi

#
# Keybase (go)
#

echo "Building keybase..."
echo "  Updating version.go ($VERSION)"
echo "package libkb\n\nvar CLIENT_VERSION = \"$VERSION\"\n" > $KB_GO_SRC/libkb/version.go
cd $KB_GO_SRC/keybase
echo "  Compiling..."
go build -a
cp $KB_GO_SRC/keybase/keybase $BUILD_DEST/keybase
echo "  Done"
echo "  "

#
# Keybase.app
#

echo "Building Keybase.app"

#KB_SERVICE_VERSION=`$BUILD_DEST/keybase version 2>/dev/null | head -1 | rev | cut -f1 -d ' ' | rev | tail -c +2`
#echo "  Checking version: $KB_SERVICE_VERSION"

KB_SERVICE_VERSION=$VERSION # Use until we can better parse from command line

echo "  Updating plists..."
PLIST=$DIR/../Keybase/Info.plist

HELPER_PLIST=$DIR/../Helper/Info.plist
KB_HELPER_VERSION=`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" $HELPER_PLIST`
echo "  keybase.Helper Version: $KB_HELPER_VERSION"

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KeybaseServiceVersion '${KB_SERVICE_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KeybaseHelperVersion '${KB_HELPER_VERSION}'" $PLIST
echo "  Updated $PLIST"
echo "  "

echo "  Cleaning..."
set -o pipefail && xcodebuild clean -scheme Keybase -workspace $DIR/../Keybase.xcworkspace -configuration Release | xcpretty -c

echo "  Archiving..."
set -o pipefail && xcodebuild archive -scheme Keybase -workspace $DIR/../Keybase.xcworkspace -configuration Release -archivePath $BUILD_DEST/Keybase.xcarchive | xcpretty -c

echo "  Exporting..."
set -o pipefail && xcodebuild -exportArchive -archivePath $BUILD_DEST/Keybase.xcarchive -exportFormat app -exportPath $BUILD_DEST/Keybase.app -exportSigningIdentity "$CODE_SIGN_IDENTITY" | xcpretty -c

echo "  Done"
echo "  "
