#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

build_dir=$dir/build_keybase
rm -rf $build_dir
mkdir -p $build_dir
cd $build_dir

version=$1

if [ "$version" = "" ]; then
  echo "Need to specify version"
  exit 1
fi

src_url="https://github.com/keybase/client/archive/v$version.tar.gz"

curl -O -J -L $src_url
echo "Unpacking"
tar zxpf client-$version.tar.gz
rm client-$version.tar.gz
echo "Creating GOPATH"
go_dir=$build_dir/go
mkdir -p $go_dir/src/github.com/keybase
mv client-$version $go_dir/src/github.com/keybase/client

build() {
  tags=$1
  service_bin=$2

  echo "Building $service_bin"
  GO15VENDOREXPERIMENT=1 GOPATH=$go_dir go build -a -tags "$tags" -o $service_bin github.com/keybase/client/go/keybase

  tar zcvpf $service_bin-$version.tgz $service_bin
}

build production keybase
