set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

rm -rf Keybase.dmg Applications

xcodebuild -workspace ../Keybase.xcworkspace -scheme Keybase DSTROOT=$DIR archive

echo "Copying keybase binaries..."
chmod +x keybased
cp keybased Applications/Keybase.app/Contents/MacOS/

appdmg appdmg.json Keybase.dmg
