#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

app_name="KeybaseUpdater"
plist="$dir/Updater/Info.plist"
scheme="Updater"
code_sign_identity=${CODE_SIGN_IDENTITY:-"9FC3A5BC09FA2EE307C04060C918486411869B65"}
xcode_configuration="Release"
install_app_path="/Applications/Keybase.app/Contents/Resources/$app_name.app"

build_dir="$dir/build"
mkdir -p "$build_dir"
archive_path="$build_dir/$app_name.xcarchive"

echo "Plist: $plist"
app_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $plist`"

echo "Archiving"
xcodebuild archive -scheme "$scheme" -project "$dir/Updater.xcodeproj" -configuration "$xcode_configuration" -archivePath "$archive_path" | xcpretty -c

echo "Exporting"
tmp_dir="/tmp"
tmp_app_path="$tmp_dir/$app_name.app"
export_dest="$tmp_dir/updater-build"
rm -rf "$tmp_app_path"
rm -rf "$export_dest"
xcodebuild -exportArchive -archivePath "$archive_path" -exportOptionsPlist export.plist -exportPath "$export_dest"  | xcpretty -c
mv "$export_dest/Updater.app" "$tmp_app_path"
echo "Exported to $tmp_app_path"

echo "Codesigning with $code_sign_identity"
codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$tmp_app_path"
echo "Checking codesigning..."
codesign -dvvvv "$tmp_app_path"
echo " "
spctl --assess --verbose=4 "$tmp_app_path"
echo " "

cd "$tmp_dir"
tgz="$app_name-$app_version-darwin.tgz"
echo "Packing $tgz"
tar zcvpf "$tgz" "$app_name.app"
echo "Created $tmp_dir/$tgz"

rm -rf "$install_app_path"
cp -R "$tmp_app_path" "$install_app_path"
echo "Copied $tmp_app_path to $install_app_path"
