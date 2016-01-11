#!/bin/bash

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

cd avdl
for f in *.avdl; do
  expand -t 2 $f > ~$f

  # Only mv if changed
  diff -q ~$f $f > /dev/null
  if [ "$?" = "1" ]; then
    mv ~$f $f
  else
    rm ~$f
  fi
done
