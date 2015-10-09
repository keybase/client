#! /bin/bash

# Prints out the current build mode ("production", "staging", or "devel") as
# determined from the first command line arg. This script enforces 1) that the
# argument is present, and 2) that it takes one of the three allowed values.
# This helps us avoid duplicating the same switch statement in all of our
# packaging scripts.

set -e -u -o pipefail

mode="${1:-}"  # ':-' is because this might not be defined
if [[ "$mode" = "production" || "$mode" = "staging" || "$mode" = "devel" ]] ; then
  echo "$mode"
elif [[ -n "$mode" ]] ; then
  echo "Bad build mode, '$mode'. Specify production/staging/devel." >&2
  exit 1
else
  echo "Can't determine the mode, no argument given. Specify production/staging/devel." >&2
  exit 1
fi
