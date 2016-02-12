#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

istest=${TEST:-}

if [ ! "$istest" = "1" ]; then
  go get -u -f $1
else
  go get $1
fi
go install $1
