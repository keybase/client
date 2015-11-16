#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

bin_src=$dir/bin

plist=$dir/../Keybase/Info.plist

run_mode="`/usr/libexec/plistBuddy -c "Print :KBRunMode" $plist`"
echo "Run Mode: $run_mode"

if [ "$run_mode" = "staging" ]; then
  service_bin="kbstage"
  kbfs_bin="kbfsstage"
  tags="staging"
elif [ "$run_mode" = "prod" ]; then
  service_bin="keybase"
  kbfs_bin="kbfs"
  tags="production"
else
  echo "Invalid run mode: $run_mode"
  exit 1
fi

# Build stage
#if [ ! -f $bin_src/$service_bin ]; then
echo "Building $bin_src/$service_bin"
GO15VENDOREXPERIMENT=1 go build -tags "$tags" -o $bin_src/$service_bin github.com/keybase/client/go/keybase
#fi
#if [ ! -f $bin_src/$kbfs_bin ]; then
echo "Building $bin_src/$kbfs_bin"
GO15VENDOREXPERIMENT=0 go build -tags "$tags" -o $bin_src/$kbfs_bin github.com/keybase/kbfs/kbfsfuse
#fi

# Read the versions and build numbers
echo "Checking version info..."
kb_service_version="`$bin_src/$service_bin version -S | cut -f1 -d '-'`"
kb_service_build="`$bin_src/$service_bin version -S | cut -f2 -d '-'`"

kbfs_version="`$bin_src/$kbfs_bin --version 2>&1 | cut -f1 -d '-'`"
kbfs_build="`$bin_src/$kbfs_bin --version 2>&1 | cut -f2 -d '-'`"

echo "Version (Build):"
echo "  $service_bin: $kb_service_version ($kb_service_build)"
echo "  $kbfs_bin: $kbfs_version ($kbfs_build)"

echo "Updating plist..."
/usr/libexec/plistBuddy -c "Set :KBServiceVersion '${kb_service_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBServiceBuild '${kb_service_build}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFSVersion '${kbfs_version}'" $plist
/usr/libexec/plistBuddy -c "Set :KBFSBuild '${kbfs_build}'" $plist
