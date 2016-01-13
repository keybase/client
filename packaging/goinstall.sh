#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

nopull=${NOPULL:-}

if [ ! "$nopull" = "1" ]; then
  go get -u $1
else
  go get $1
fi
go install $1
