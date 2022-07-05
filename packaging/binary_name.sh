#! /usr/bin/env bash

# Prints out the binary name ("keybase", "kbstage", or "kbdev") that
# corresponds to the current build mode. This script helps us avoid duplicating
# the same switch statement in all of our packaging scripts.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

mode="$("$here/build_mode.sh" "$@")"

if [ "$mode" = "production" -o "$mode" = "prerelease" ] ; then
  echo keybase
elif [ "$mode" = "staging" ] ; then
  echo kbstage
elif [ "$mode" = "devel" ] ; then
  echo kbdev
else
  echo ERROR could not determine package name >&2
  exit 1
fi
