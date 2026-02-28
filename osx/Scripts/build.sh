#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

app_name=${APP_NAME:-}
scheme=${SCHEME:-}
plist=${PLIST:-}

build_dest=$dir/build
mkdir -p $build_dest

# Flirting with custom configuration but xcodebuild archive will only do Release
# configuration.
xcode_configuration="Release"
code_sign_identity="90524F7BEAEACD94C7B473787F4949582F904104" # "Developer ID Application: Keybase, Inc. (99229SGT5K)"

echo "Plist: $plist"
app_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $plist`"
#app_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $plist`"

#echo "Cleaning..."
#set -o pipefail && xcodebuild clean -scheme Keybase -workspace $dir/../Keybase.xcworkspace -configuration $xcode_configuration | xcpretty -c

#
# Archive
#

archive_dir_day=$(date +"%Y-%m-%d")  # 2015-01-31
archive_postfix=$(date +"%-m-%-e-%y, %-l.%M %p") #1-31-15, 1.47 PM

archive_path="$build_dest/$app_name.xcarchive"
app_path="$build_dest/$app_name.app"

rm -rf $archive_path

echo "Archiving..."
set -o pipefail && xcodebuild archive -scheme "$scheme" -workspace "$dir/../Keybase.xcworkspace" -configuration "$xcode_configuration" -archivePath "$archive_path" -destination 'platform=macOS' | xcpretty -c 

# echo "Copying to archive"
# archive_hold_path="/Users/gabe/Library/Developer/Xcode/Archives/$archive_dir_day/$app_name $archive_postfix.xcarchive"
# echo "Copying archive to $archive_hold_path"
# ditto "$archive_path" "$archive_hold_path"

#
# Export
#

rm -rf "$app_path"

echo "Exporting..."
set -o pipefail && xcodebuild -exportArchive -archivePath $archive_path -exportOptionsPlist export.plist -exportPath "$build_dest" | xcpretty -c
mv "$build_dest/Keybase.app" "$app_path"

echo "Done"
echo ""

cd "$build_dest"

echo "Copying kbfuse.bundle..."
ditto ../../Fuse/kbfuse.bundle $app_name.app/Contents/Resources/kbfuse.bundle

echo "

xCode has trouble signing with Developer IDs properly so we need to re-sign.

NOTE: If codesigning fails (ambiguous certificate) you need to manually delete
the (old) March 12th version of the certificate from your Keychain.

Re-signing using identity:

$code_sign_identity

"

helper="$app_name.app/Contents/Library/LaunchServices/keybase.Helper"
codesign --verbose -o library --force --timestamp --options runtime --preserve-metadata=identifier,entitlements --sign "$code_sign_identity" "$helper"

codesign --verbose -o library --force  --deep --timestamp --options runtime --sign  "$code_sign_identity"  $app_name.app
echo " "

echo "Checking app..."
codesign -dvvvv $app_name.app
echo " "
spctl --assess --verbose=4 $app_name.app
echo "Checking Helper..."
codesign -dvvvv $app_name.app/Contents/Library/LaunchServices/keybase.Helper
# You don't spctl assess binaries anymore (only bundles)
# http://www.openradar.me/25618668
#spctl --assess --verbose=4 $app_name.app/Contents/Library/LaunchServices/keybase.Helper
echo " "

tar zcvpf $app_name-$app_version-darwin.tgz $app_name.app

open $build_dest
