#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
DEST=$DIR

if [ "$1" = "" ]; then
  echo "Specify a version."
  exit 1
fi

VERSION="$1"

echo "Version: $VERSION"

KB_GO_SRC=$GOPATH/src/github.com/keybase/client/go

echo "package libkb\n\nvar CLIENT_VERSION = \"$VERSION\"\n" > $KB_GO_SRC/libkb/version.go

#
# Daemon
#

DAEMON_SRC=$KB_GO_SRC/daemon
echo "Using keybased source: $DAEMON_SRC"
cd $DAEMON_SRC

echo "Building keybased (go build -a)..."
go build -a

echo "Copying keybased to $DEST"
cp $DAEMON_SRC/daemon $DEST/keybased

#
# CLI
#

CLI_SRC=$KB_GO_SRC/client
echo "Using keybase source: $CLI_SRC"
cd $CLI_SRC

echo "Building keybase (go build -a)..."
go build -a

echo "Copying keybase to $DEST"
cp $CLI_SRC/client $DEST/keybase

#
# Update app version
#

cd $DEST

KB_BIN_VERSION=`./keybased --version`
KB_VERSION="${KB_BIN_VERSION##* }"
echo "Keybased Version: $KB_VERSION"

PLIST=$DIR/../Keybase/Info.plist

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBKeybasedVersion '${KB_VERSION}'" $PLIST

#
# Keybase.app
#

cd $DEST

rm -rf Keybase.xcarchive
rm -rf Keybase.app

echo "Building Keybase.app"
set -o pipefail && xcodebuild clean -scheme Keybase -workspace ../Keybase.xcworkspace -configuration Release | xcpretty -c
set -o pipefail && xcodebuild archive -scheme Keybase -workspace ../Keybase.xcworkspace -configuration Release -archivePath Keybase.xcarchive | xcpretty -c
set -o pipefail && xcodebuild -exportArchive -archivePath Keybase.xcarchive -exportFormat app -exportPath Keybase.app -exportSigningIdentity  "Developer ID Application: Keybase, Inc. (99229SGT5K)" | xcpretty -c

rm -rf Keybase.xcarchive
