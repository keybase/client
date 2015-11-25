#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

run_mode=$1

if [ ! "$run_mode" = "staging" ] && [ ! "$run_mode" = "prod" ] && [ ! "$run_mode" = "devel" ]; then
  echo "Invalid run mode: $run_mode"
  exit 1
fi

plist=$dir/../Keybase/Info.plist
/usr/libexec/plistBuddy -c "Set :KBRunMode '${run_mode}'" $plist

echo "Set Run Mode: $run_mode"
