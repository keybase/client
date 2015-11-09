#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

action=$1

bin_src=$dir/bin
build_dest=$dir/build

rm -rf $build_dest
mkdir -p $build_dest

# Flirting with custom configuration but xcodebuild archive will only do Release
# configuration.
xcode_configuration="Release"
code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"

plist=$dir/../Keybase/Info.plist
run_mode="`/usr/libexec/plistBuddy -c "Print :KBRunMode" $plist`"
app_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $plist`"
app_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $plist`"

echo "Run Mode: $run_mode"

if [ "$run_mode" = "staging" ]; then
  app_name="KeybaseStage"
  appdmg="appdmg-staging.json"
elif [ "$run_mode" = "prod" ]; then
  app_name="Keybase"
  appdmg="appdmg.json"
else
  echo "Invalid run mode: $run_mode"
  exit 1
fi

echo "Cleaning..."
set -o pipefail && xcodebuild clean -scheme Keybase -workspace $dir/../Keybase.xcworkspace -configuration $xcode_configuration | xcpretty -c

#
# Archive
#

archive_dir_day=$(date +"%Y-%m-%d")  # 2015-01-31
archive_postfix=$(date +"%-m-%-e-%y, %-l.%M %p") #1-31-15, 1.47 PM

archive_path="$build_dest/$app_name.xcarchive"
app_path="$build_dest/$app_name.app"

rm -rf $archive_path

echo "Archiving..."
set -o pipefail && xcodebuild archive -scheme Keybase -workspace $dir/../Keybase.xcworkspace -configuration $xcode_configuration -archivePath $archive_path | xcpretty -c

# echo "Copying to archive"
# archive_hold_path="/Users/gabe/Library/Developer/Xcode/Archives/$archive_dir_day/$app_name $archive_postfix.xcarchive"
# echo "Copying archive to $archive_hold_path"
# ditto "$archive_path" "$archive_hold_path"

#
# Export
#

rm -rf $app_path

echo "Exporting..."
set -o pipefail && xcodebuild -exportArchive -archivePath $archive_path -exportFormat app -exportPath $app_path | xcpretty -c

echo "Done"
echo ""

#
# Package
#

cd $build_dest

echo "

xCode has trouble signing with Developer IDs properly so we need to re-sign.

NOTE: If codesigning fails (ambiguous certificate) you need to manually delete
the (old) March 4th version of the certificate from your Keychain.

Re-signing using identitiy:

$code_sign_identity

"

codesign --verbose --force --preserve-metadata=identifier,entitlements --timestamp=none --sign "$code_sign_identity" $app_name.app/Contents/Library/LaunchServices/keybase.Helper
codesign --verbose --force --deep --timestamp=none --sign "$code_sign_identity" $app_name.app

# Verify
#codesign --verify --verbose=4 Keybase.app
#spctl --assess --verbose=4 /Applications/Keybase.app/Contents/Library/LaunchServices/keybase.Helper

echo "Checking app..."
codesign -dvvvv $app_name.app
echo " "
spctl --assess --verbose=4 $app_name.app
echo "Checking Helper..."
codesign -dvvvv $app_name.app/Contents/Library/LaunchServices/keybase.Helper
echo " "
spctl --assess --verbose=4 $app_name.app/Contents/Library/LaunchServices/keybase.Helper

dmg_name="$app_name-$app_version-$app_build.dmg"

if [ "$action" == "install" ]; then

  if [ -f /Applications/$app_name.app ]; then
    trash /Applications/$app_name.app
  fi
  ditto $app_name.app /Applications/$app_name.app

elif [ "$action" == "dmg" ]; then

  rm -rf $dmg_name

  cp ../appdmg/* .

  appdmg $appdmg $dmg_name

else

  echo "
  To open the build dir:

    open build

  To open the DMG:

    open build/$dmg_name

  The build was archived to:

    $archive_hold_path
  "
fi
