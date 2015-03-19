set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

if [ ! -d "Keybase.app" ]; then
	echo "You need to Export an archived build from Xcode (Keybase.app)"
	exit 1
fi

if [ ! -f "keybased" ]; then
	echo "You need to build the keybase binaries (build_keybase.sh)"
	exit 1
fi

# Clean up
rm -rf Keybase.dmg

VERSION=`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" Keybase.app/Contents/Info.plist`
echo "Version: $VERSION"

echo "Copying keybase binaries into Keybase.app..."
chmod +x keybased
cp keybased Keybase.app/Contents/MacOS/

echo "Resigning..."
# Re-sign since we copied in keybased
codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." Keybase.app

# Verify
#codesign --verify --verbose=4 Keybase.app

appdmg appdmg.json Keybase-$VERSION.dmg
