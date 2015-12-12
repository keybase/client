#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

build_dir_keybase="/tmp/build_keybase"
build_dir_kbfs="/tmp/build_kbfs"

BUILD_DIR=$build_dir_keybase ./build_keybase.sh
BUILD_DIR=$build_dir_kbfs ./build_kbfs.sh

cd $dir/../desktop
save_dir="/tmp/build_desktop"
SAVE_DIR=$save_dir KEYBASE_BINPATH="$build_dir_keybase/keybase" KBFS_BINPATH="$build_dir_kbfs/kbfs" ./package_darwin.sh

s3cmd sync --skip-existing $save_dir/* s3://keybase-app/
