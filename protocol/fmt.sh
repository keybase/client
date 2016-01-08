#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

cd avdl
for f in *.avdl; do
  expand -t 2 $f > ~$f
  mv ~$f $f
done
