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
echo "Unpacking"
tar zxpf kbfs-beta-$version.tar.gz
rm kbfs-beta-$version.tar.gz
echo "Creating GOPATH"
go_dir=$build_dir/go
mkdir -p $go_dir/src/github.com
mv kbfs-beta-$version $go_dir/src/github.com/keybase

build() {
  tags=$1
  kbfs_bin=$2

  echo "Building $kbfs_bin"
  GO15VENDOREXPERIMENT=0 GOPATH=$go_dir go get github.com/keybase/kbfs/kbfsfuse
  GO15VENDOREXPERIMENT=0 GOPATH=$go_dir go build -a -tags "$tags" -o $kbfs_bin github.com/keybase/kbfs/kbfsfuse

  tar zcvpf $kbfs_bin-$version.tgz $kbfs_bin
}

build production kbfs
