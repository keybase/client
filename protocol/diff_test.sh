#! /usr/bin/env bash

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
cd "$here"

npm i
make clean
make

# Protocol changes could create diffs in the following directories:
#   protocol/
#   go/
#   shared/
# This build process is idempotent. We expect there to be no changes after
# re-running the protocol generation, because any changes should have been
# checked in.

if ! git diff --exit-code ./ ../go/ ../shared/; then
  echo 'ERROR: `git diff` detected changes. The generated protocol files are stale.'
  exit 1
fi

( cd .. &&
  if [ "`git ls-files --others --exclude-standard`" ]; then
    echo 'ERROR: git detected that building the protocol resulted in newly created files. The generated protocol files are stale.'
    exit 1
  fi
  cd protocol
)

echo 'SUCCESS: The generated protocol files are up to date.'
