#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

build_dest=$dir/build
rm -rf $build_dest
mkdir -p $build_dest

sh versions.sh
sh build-bin.sh

sh build-app.sh staging dmg
sh build-app.sh prod dmg
