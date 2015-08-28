#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

BUILD_DEST=$DIR/build

ACTION=$1

KB_GO_SRC="$GOPATH/src/github.com/keybase/client/go"
KBFS_GO_SRC="$GOPATH/src/github.com/keybase/kbfs"
CODE_SIGN_IDENTITY="Developer ID Application: Keybase, Inc. (99229SGT5K)"

# Clear existing build dir
rm -rf $BUILD_DEST
mkdir -p $BUILD_DEST

#
# Build go services.
# If the are already present, don't rebuild.
#

if [ ! -f "$KB_GO_SRC/keybase/keybase" ]; then
  echo "Using source: $KB_GO_SRC"
  echo "Compiling keybase (go)..."
  cd $KB_GO_SRC/keybase/
  go build -a
fi
echo "Copying: $KB_GO_SRC/keybase/keybase"
cp $KB_GO_SRC/keybase/keybase $BUILD_DEST/keybase
chmod +x $BUILD_DEST/keybase

if [ ! -f "$KB_GO_SRC/keybase/keybase" ]; then
  echo "Using KBFS source: $KBFS_GO_SRC"
  echo "Compiling kbfs..."
  cd $KBFS_GO_SRC/kbfsd/
  go build -a
fi
echo "Copying: $KBFS_GO_SRC/kbfsd/kbfsd"
cp $KBFS_GO_SRC/kbfsd/kbfsd $BUILD_DEST/kbfsd
chmod +x $BUILD_DEST/kbfsd

# Read the versions and build numbers
echo "Checking versions"
KB_SERVICE_VERSION="`$BUILD_DEST/keybase version -d | cut -f1 -d '-'`"
KB_SERVICE_BUILD="`$BUILD_DEST/keybase version -d | cut -f2 -d '-'`"

KBFS_VERSION="`$BUILD_DEST/kbfsd --version 2>&1 | cut -f1 -d '-'`"
KBFS_BUILD="`$BUILD_DEST/kbfsd --version 2>&1 | cut -f2 -d '-'`"

# CFBundleShortVersionString is the MAJOR.MINOR.TINY, for example, "1.2.3".
# CFBundleVersion is the build number, for example, "12345" or "1.2.3 (build 12345AB)"

PLIST=$DIR/../Keybase/Info.plist
APP_VERSION="`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" $PLIST`"
APP_BUILD="`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" $PLIST`"

HELPER_PLIST=$DIR/../Helper/Info.plist
KB_HELPER_VERSION="`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" $HELPER_PLIST`"
KB_HELPER_BUILD="`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" $HELPER_PLIST`"

FUSE_PLIST=$DIR/Fuse/osxfusefs.bundle/Contents/Info.plist
FUSE_VERSION="`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" $FUSE_PLIST`"
FUSE_BUILD="`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" $FUSE_PLIST`"

echo "Version (Build):"
echo "  Keybase.app: $APP_VERSION ($APP_BUILD)"
echo "  Service: $KB_SERVICE_VERSION ($KB_SERVICE_BUILD)"
echo "  KBFS: $KBFS_VERSION ($KBFS_BUILD)"
echo "  Helper: $KB_HELPER_VERSION ($KB_HELPER_BUILD)"
echo "  Fuse: $FUSE_VERSION ($FUSE_BUILD)"
echo ""

echo "Is the correct?"
select o in "Yes" "No"; do
    case $o in
        Yes ) break;;
        No ) exit;;
    esac
done

echo "  Updating $PLIST"
/usr/libexec/PlistBuddy -c "Set :KBServiceVersion '${KB_SERVICE_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBServiceBuild '${KB_SERVICE_BUILD}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBHelperVersion '${KB_HELPER_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBHelperBuild '${KB_HELPER_BUILD}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBFSVersion '${KBFS_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBFSBuild '${KBFS_BUILD}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBFuseVersion '${FUSE_VERSION}'" $PLIST
/usr/libexec/PlistBuddy -c "Set :KBFuseBuild '${FUSE_BUILD}'" $PLIST
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

APP_PATH="$BUILD_DEST/Keybase.app"

rm -rf $ARCHIVE_PATH

echo "  Archiving..."
set -o pipefail && xcodebuild archive -scheme Keybase -workspace $DIR/../Keybase.xcworkspace -configuration Release -archivePath $ARCHIVE_PATH | xcpretty -c

echo "  Copying archive to $ARCHIVE_HOLD_PATH"
ditto "$ARCHIVE_PATH" "$ARCHIVE_HOLD_PATH"

#
# Export
#

rm -rf $APP_PATH

echo "  Exporting..."
set -o pipefail && xcodebuild -exportArchive -archivePath $ARCHIVE_PATH -exportFormat app -exportPath $APP_PATH | xcpretty -c

echo "  Done"
echo "  "

#
# Package
#

cd $BUILD_DEST

echo "Copying keybase into Keybase.app..."
chmod +x keybase
SUPPORT_BIN="Keybase.app/Contents/SharedSupport/bin"
mkdir -p $SUPPORT_BIN
cp keybase $SUPPORT_BIN
cp kbfsd $SUPPORT_BIN

echo "Re-signing..."
# Need to sign contents first (helper), then app bundle
codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." Keybase.app/Contents/Library/LaunchServices/keybase.Helper
codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." Keybase.app

# Verify
#codesign --verify --verbose=4 Keybase.app
#spctl --assess --verbose=4 /Applications/Keybase.app/Contents/Library/LaunchServices/keybase.Helper

echo "Checking Helper..."
spctl --assess --verbose=4 Keybase.app/Contents/Library/LaunchServices/keybase.Helper


rm -rf Keybase-$APP_VERSION.dmg

cp ../appdmg/* .

appdmg appdmg.json Keybase-$APP_VERSION.dmg

if [ "$ACTION" = "install" ]; then
  ditto $BUILD_DEST/Keybase.app /Applications/Keybase.app
  echo "Installed to Applications"
else
  echo "
  To install into Applications:

    ditto build/Keybase.app /Applications/Keybase.app

  To open the build dir:

    open build

  To open the DMG:

    open build/Keybase-$APP_VERSION.dmg

  The build was archived to:

    $ARCHIVE_HOLD_PATH
  "
fi
