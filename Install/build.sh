DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

rm Keybase.dmg
rm -rf Applications

xcodebuild -workspace ../Keybase.xcworkspace -scheme Keybase DSTROOT=$DIR archive

appdmg appdmg.json Keybase.dmg
