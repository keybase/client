#! /usr/bin/env bash

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
cd "$here"

npm i
make clean
make

if ! git diff --exit-code ; then
  echo 'ERROR: `git diff` detected changes. The generated protocol files are stale.'
  exit 1
fi

echo 'SUCCESS: The generated protocol files are up to date.'
