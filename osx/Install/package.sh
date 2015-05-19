#!/bin/sh

set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

BUILD_DEST=$DIR/build
cd $BUILD_DEST

if [ ! -d "Keybase.app" ]; then
	echo "You need to Export an archived build from Xcode (Keybase.app)"
	exit 1
fi

if [ ! -f "keybase" ]; then
	echo "Missing keybase binary"
	exit 1
fi

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

echo "What do you want to do?"
select o in "Install" "Open" "Exit"; do
    case $o in
        Install ) ditto Keybase.app /Applications/Keybase.app; break;;
        Open ) open Keybase-$VERSION.dmg; break;;
        Exit ) exit;;
    esac
done

