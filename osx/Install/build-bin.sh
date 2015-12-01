#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

bin_src=$dir/bin
mkdir -p $bin_src

build() {
  tags=$1
  service_bin=$2
  kbfs_bin=$3

  echo "Building $bin_src/$service_bin"
  GO15VENDOREXPERIMENT=1 go build -tags "$tags" -o $bin_src/$service_bin github.com/keybase/client/go/keybase
  echo "Building $bin_src/$kbfs_bin"
  GO15VENDOREXPERIMENT=0 go build -tags "$tags" -o $bin_src/$kbfs_bin github.com/keybase/kbfs/kbfsfuse
}

#build devel kbdev kbfsdev
#build staging kbstage kbfsstage
build production keybase kbfs
