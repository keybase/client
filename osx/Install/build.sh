#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

BUILD_DEST=$DIR/build

if [ "$1" = "" ]; then
  echo "Specify a version."
  exit 1
fi

KB_GO_SRC="$GOPATH/src/github.com/keybase/client/go"
KBFS_GO_SRC="$GOPATH/src/github.com/keybase/kbfs"
VERSION="$1"
CODE_SIGN_IDENTITY="Developer ID Application: Keybase, Inc. (99229SGT5K)"


if [ -d "$BUILD_DEST" ]; then
  echo "Build directory already exists: $BUILD_DEST"
  echo " "
  echo "You probably want to remove it and try this again."
  exit 1
fi

#
# Keybase (go)
#

echo "Building Keybase (go)..."
echo "  Using source: $KB_GO_SRC"
echo "  Generating version.go ($VERSION)"
echo "package libkb\n\nvar CLIENT_VERSION = \"$VERSION\"\n" > $KB_GO_SRC/libkb/version.go
mkdir -p $BUILD_DEST
echo "  Compiling..."
cd $KB_GO_SRC/keybase/
go build -a
cp $KB_GO_SRC/keybase/keybase $BUILD_DEST/keybase
chmod +x $BUILD_DEST/keybase

echo "  Using KBFS source: $KBFS_GO_SRC"
echo "  Compiling..."
cd $KBFS_GO_SRC/kbfsfuse/
go build -a
cp $KBFS_GO_SRC/kbfsfuse/kbfsfuse $BUILD_DEST/kbfsfuse
chmod +x $BUILD_DEST/kbfsfuse
echo "  Done"
echo "  "

#
# Keybase.app
#

echo "Keybase.app"

#KB_SERVICE_VERSION=`$BUILD_DEST/keybase version 2>/dev/null | head -1 | rev | cut -f1 -d ' ' | rev | tail -c +2`
#echo "  Checking version: $KB_SERVICE_VERSION"

KB_SERVICE_VERSION=$VERSION # Use until we can better parse from command line

PLIST=$DIR/../Keybase/Info.plist
HELPER_PLIST=$DIR/../Helper/Info.plist
FUSE_PLIST=$DIR/Fuse/osxfusefs.fs.bundle/Contents/Info.plist
KB_HELPER_VERSION=`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" $HELPER_PLIST`
KB_FUSE_VERSION=`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" $FUSE_PLIST`
KBFS_VERSION="0.1.1" # Doesn't report version yet

echo "  Keybase.app Version: $VERSION"
echo "  Service Version: $KB_SERVICE_VERSION"
echo "  Helper Version: $KB_HELPER_VERSION"
echo "  KBFS Version: $KBFS_VERSION"
echo "  Fuse Version: $KB_FUSE_VERSION"

echo "  Updating $PLIST..."
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString '${VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBServiceVersion '${KB_SERVICE_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBHelperVersion '${KB_HELPER_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBFSVersion '${KBFS_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBFuseVersion '${KB_FUSE_VERSION}'" $PLIST
echo "  "

echo "  Cleaning..."
set -o pipefail && xcodebuild clean -scheme Keybase -workspace $DIR/../Keybase.xcworkspace -configuration Release | xcpretty -c

#
# Archive
#

ARCHIVE_DIR_DAY=$(date +"%Y-%m-%d")  # 2015-01-31
ARCHIVE_POSTFIX=$(date +"%-m-%-e-%y, %-l.%M %p") #1-31-15, 1.47 PM

ARCHIVE_PATH="$BUILD_DEST/Keybase.xcarchive"
ARCHIVE_HOLD_PATH="/Users/gabe/Library/Developer/Xcode/Archives/$ARCHIVE_DIR_DAY/Keybase $ARCHIVE_POSTFIX.xcarchive"

echo "  Archiving..."
set -o pipefail && xcodebuild archive -scheme Keybase -workspace $DIR/../Keybase.xcworkspace -configuration Release -archivePath $ARCHIVE_PATH | xcpretty -c

echo "  Copying archive to $ARCHIVE_HOLD_PATH"
ditto "$ARCHIVE_PATH" "$ARCHIVE_HOLD_PATH"

#
# Export
#

echo "  Exporting..."
set -o pipefail && xcodebuild -exportArchive -archivePath /Users/gabe/Projects/go/src/github.com/keybase/client/osx/Install/build/Keybase.xcarchive -exportFormat app -exportPath /Users/gabe/Projects/go/src/github.com/keybase/client/osx/Install/build/Keybase.app | xcpretty -c

echo "  Done"
echo "  "

#
# Package
#

cd $BUILD_DEST

VERSION=`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" Keybase.app/Contents/Info.plist`
echo "Keybase.app Version: $VERSION"

KB_SERVICE_VERSION=`/usr/libexec/PlistBuddy -c "Print :KBServiceVersion" Keybase.app/Contents/Info.plist`
echo "Service Version: $KB_SERVICE_VERSION"

KB_HELPER_VERSION=`/usr/libexec/PlistBuddy -c "Print :KBHelperVersion" Keybase.app/Contents/Info.plist`
echo "Helper Version: $KB_HELPER_VERSION"

KBFS_VERSION=`/usr/libexec/PlistBuddy -c "Print :KBFSVersion" Keybase.app/Contents/Info.plist`
echo "KBFS Version: $KBFS_VERSION"

KB_FUSE_VERSION=`/usr/libexec/PlistBuddy -c "Print :KBFuseVersion" Keybase.app/Contents/Info.plist`
echo "Fuse Version: $KB_FUSE_VERSION"

#KB_HELPER_VERSION=`otool -s __TEXT __info_plist Keybase.app/Contents/Library/LaunchServices/keybase.Helper`
#echo "Keybased Helper Version : $KB_HELPER_VERSION"

echo "Copying keybase into Keybase.app..."
chmod +x keybase
SUPPORT_BIN="Keybase.app/Contents/SharedSupport/bin"
mkdir -p $SUPPORT_BIN
cp keybase $SUPPORT_BIN
cp kbfsfuse $SUPPORT_BIN

# Verify
#codesign --verify --verbose=4 Keybase.app

#echo "Re-signing..."
#codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." Keybase.app

rm -rf Keybase-$VERSION.dmg

cp ../appdmg/* .

appdmg appdmg.json Keybase-$VERSION.dmg

echo "
To install into Applications:

  ditto build/Keybase.app /Applications/Keybase.app

To open the DMG:

  open build/Keybase-$VERSION.dmg
"

# echo "What do you want to do?"
# select o in "Install" "Open" "Exit"; do
#     case $o in
#         Install ) ditto Keybase.app /Applications/Keybase.app; break;;
#         Open ) open Keybase-$VERSION.dmg; break;;
#         Exit ) exit;;
#     esac
# done
