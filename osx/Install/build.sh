#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

build_dest=$dir/build
mkdir -p $build_dest

run_mode=$1

action=$2

# Flirting with custom configuration but xcodebuild archive will only do Release
# configuration.
xcode_configuration="Release"

if [ "$run_mode" = "staging" ]; then
  app_name="KeybaseStage"
  service_bin="kbstage"
  kbfs_bin="kbfsstage"
  appdmg="appdmg-staging.json"
  tags="staging"
elif [ "$run_mode" = "prod" ]; then
  app_name="Keybase"
  service_bin="keybase"
  kbfs_bin="kbfs"
  appdmg="appdmg.json"
  tags="production"
else
  echo "Invalid run mode: $run_mode"
  exit 1
fi

code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"

# Build
if [ ! -f $build_dest/$service_bin ]; then
  echo "Building $build_dest/$service_bin"
  GO15VENDOREXPERIMENT=1 go build -tags $tags -o $build_dest/$service_bin github.com/keybase/client/go/keybase
fi
if [ ! -f $build_dest/$kbfs_bin ]; then
  echo "Building $build_dest/$kbfs_bin"
  GO15VENDOREXPERIMENT=0 go build -tags $tags -o $build_dest/$kbfs_bin github.com/keybase/kbfs/kbfsfuse
fi

# Read the versions and build numbers
echo "Checking version info for components"
kb_service_version="`$build_dest/$service_bin version -S | cut -f1 -d '-'`"
kb_service_build="`$build_dest/$service_bin version -S | cut -f2 -d '-'`"

kbfs_version="`$build_dest/$kbfs_bin --version 2>&1 | cut -f1 -d '-'`"
kbfs_build="`$build_dest/$kbfs_bin --version 2>&1 | cut -f2 -d '-'`"

# CFBundleShortVersionString is the MAJOR.MINOR.TINY, for example, "1.2.3".
# CFBundleVersion is the build number, for example, "12345" or "1.2.3 (build 12345AB)"

plist=$dir/../Keybase/Info.plist
app_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $plist`"
app_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $plist`"

helper_list=$dir/../Helper/Info.plist
KB_HELPER_VERSION="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $helper_list`"
KB_HELPER_BUILD="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $helper_list`"

fuse_plist=$dir/Fuse/3.x/osxfuse3.bundle/Contents/Info.plist
fuse_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $fuse_plist`"
fuse_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $fuse_plist`"

echo "Version (Build):"
echo "  $app_name.app: $app_version ($app_build)"
echo "  $service_bin: $kb_service_version ($kb_service_build)"
echo "  $kbfs_bin: $kbfs_version ($kbfs_build)"
echo "  keybase.Helper: $KB_HELPER_VERSION ($KB_HELPER_BUILD)"
echo "  Fuse: $fuse_version ($fuse_build)"
echo ""

echo "Is the correct?"
select o in "Yes" "No"; do
    case $o in
        Yes ) break;;
        No ) exit;;
    esac
done

echo "  Updating $plist"
/usr/libexec/plistBuddy -c "Set :KBServiceVersion '${kb_service_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBServiceBuild '${kb_service_build}'" $plist
/usr/libexec/plistBuddy -c "Set :KBHelperVersion '${KB_HELPER_VERSION}'" $plist
/usr/libexec/plistBuddy -c "Set :KBHelperBuild '${KB_HELPER_BUILD}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFSVersion '${kbfs_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFSBuild '${kbfs_build}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFuseVersion '${fuse_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFuseBuild '${fuse_build}'" $plist
/usr/libexec/plistBuddy -c "Set :KBRunMode '${run_mode}'" $plist
echo "  "

echo "  Cleaning..."
set -o pipefail && xcodebuild clean -scheme Keybase -workspace $dir/../Keybase.xcworkspace -configuration $xcode_configuration | xcpretty -c

#
# Archive
#

archive_dir_day=$(date +"%Y-%m-%d")  # 2015-01-31
archive_postfix=$(date +"%-m-%-e-%y, %-l.%M %p") #1-31-15, 1.47 PM

archive_path="$build_dest/$app_name.xcarchive"
archive_hold_path="/Users/gabe/Library/Developer/Xcode/Archives/$archive_dir_day/$app_name $archive_postfix.xcarchive"

app_path="$build_dest/$app_name.app"

rm -rf $archive_path

echo "  Archiving..."
set -o pipefail && xcodebuild archive -scheme Keybase -workspace $dir/../Keybase.xcworkspace -configuration $xcode_configuration -archivePath $archive_path | xcpretty -c

echo "  Copying archive to $archive_hold_path"
ditto "$archive_path" "$archive_hold_path"

#
# Export
#

rm -rf $app_path

echo "  Exporting..."
set -o pipefail && xcodebuild -exportArchive -archivePath $archive_path -exportFormat app -exportPath $app_path | xcpretty -c

echo "  Done"
echo "  "

#
# Package
#

cd $build_dest

echo "Copying support binaries into $app_name.app..."
chmod +x $service_bin
chmod +x $kbfs_bin
support_bin="$app_name.app/Contents/SharedSupport/bin"
mkdir -p $support_bin
cp $service_bin $support_bin
cp $kbfs_bin $support_bin

echo "

Re-signing...

NOTE: If codesigning fails (ambiguous certificate) you need to manually delete
the (old) March 4th version of the certificate from your Keychain.

$code_sign_identity

"

#codesign --verbose --force --deep --sign "$code_sign_identity" $app_name.app/Contents/Library/LaunchServices/keybase.Helper
codesign --verbose --force --deep --sign "$code_sign_identity" $app_name.app

# Verify
#codesign --verify --verbose=4 Keybase.app
#spctl --assess --verbose=4 /Applications/Keybase.app/Contents/Library/LaunchServices/keybase.Helper

echo "Checking Helper..."
spctl --assess --verbose=4 $app_name.app/Contents/Library/LaunchServices/keybase.Helper

dmg_name="$app_name-$app_version-$app_build.dmg"

if [ "$action" == "install" ]; then

  #trash /Applications/$app_name.app
  ditto $app_name.app /Applications/$app_name.app

  spctl --assess --verbose=4 /Applications/$app_name.app
  spctl --assess --verbose=4 /Applications/$app_name.app/Contents/Library/LaunchServices/keybase.Helper


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
