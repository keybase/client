#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

build_dir=$dir/build_kbfs
rm -rf $build_dir
mkdir -p $build_dir
cd $build_dir

version=$1

if [ "$version" = "" ]; then
  echo "Need to specify version"
  exit 1
fi

src_url="https://github.com/keybase/kbfs-beta/archive/v$version.tar.gz"

curl -O -J -L $src_url
tgz="kbfs-beta-$version.tar.gz"
echo "Unpacking $tgz"
tar zxpf $tgz
rm $tgz
echo "Creating GOPATH"
go_dir=/tmp/go
rm -rf "$go_dir"
mkdir -p $go_dir/src/github.com
mv kbfs-beta-$version $go_dir/src/github.com/keybase

kbfs_build="/tmp/build_kbfs2"
mkdir -p "$kbfs_build"

TAGS="production" GOPATH="$go_dir" KBFS_BUILD=0 BUILD_DIR="$kbfs_build" $dir/../prerelease/build_kbfs.sh

cd "$kbfs_build"
tar zcvpf kbfs-$version.tgz kbfs
