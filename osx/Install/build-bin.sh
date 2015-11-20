#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

bin_src=$dir/bin
plist=$dir/../Keybase/Info.plist


build() {
  tags=$1
  service_bin=$2
  kbfs_bin=$3

  echo "Building $bin_src/$service_bin"
  GO15VENDOREXPERIMENT=1 go build -tags "$tags" -o $bin_src/$service_bin github.com/keybase/client/go/keybase
  echo "Building $bin_src/$kbfs_bin"
  GO15VENDOREXPERIMENT=0 go build -tags "$tags" -o $bin_src/$kbfs_bin github.com/keybase/kbfs/kbfsfuse


}

update_version() {
  service_bin=$1
  kbfs_bin=$2
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
}

build staging kbstage kbfsstage
build production keybase kbfs
update_version keybase kbfs
