set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

rm -rf Keybase.dmg Applications

# Build in Xcode and Export
#xcodebuild -workspace ../Keybase.xcworkspace -scheme Keybase DSTROOT=$DIR archive

if [ ! -d "Keybase.app" ]; then
	echo "You need to Export an archived build from Xcode (Keybase.app)"
	exit 1
fi

if [ ! -f "keybased" ]; then
	echo "You need to build the keybase binaries (build_keybase.sh)"
	exit 1
fi

echo "Copying keybase binaries into Keybase.app..."
chmod +x keybased
cp keybased Keybase.app/Contents/MacOS/

appdmg appdmg.json Keybase.dmg
