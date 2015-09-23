#! /bin/bash

# Prints out the current build mode ("release", "staging", or "devel") as
# determined from $KEYBASE_BUILD_MODE. This script helps us avoid duplicating
# the same switch statement in all of our packaging scripts.

set -e -u -o pipefail

mode="${KEYBASE_BUILD_MODE:-}"  # ':-' is because this might not be defined
if [ "$mode" = "release" ] ; then
  echo release
elif [ "$mode" = "staging" ] ; then
  echo staging
else
  echo devel
fi
