#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

# CFBundleShortVersionString is the MAJOR.MINOR.TINY, for example, "1.2.3".
# CFBundleVersion is the build number, for example, "12345" or "1.2.3 (build 12345AB)"

plist=$dir/../Installer/Info.plist
echo "Plist: $plist"
app_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $plist`"
app_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $plist`"

helper_list=$dir/../Helper/Info.plist
kb_helper_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $helper_list`"
kb_helper_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $helper_list`"

fuse_plist=$dir/../Fuse/kbfuse.bundle/Contents/Info.plist
fuse_version="`/usr/libexec/plistBuddy -c "Print :CFBundleShortVersionString" $fuse_plist`"
fuse_build="`/usr/libexec/plistBuddy -c "Print :CFBundleVersion" $fuse_plist`"

echo "Version (Build):"
echo "  keybase.Helper: $kb_helper_version ($kb_helper_build)"
echo "  Fuse3: $fuse_version ($fuse_build)"
echo ""

echo "Updating plist..."
/usr/libexec/plistBuddy -c "Set :KBHelperVersion '${kb_helper_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBHelperBuild '${kb_helper_build}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFuseVersion '${fuse_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFuseBuild '${fuse_build}'" $plist
echo "  "
