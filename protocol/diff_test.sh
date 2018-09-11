#! /usr/bin/env bash

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
cd "$here"

# First let's get the index clean from other files that CI runs
git add -A ./ ../go/ ../shared/

npm i
make clean
make

# Protocol changes could create diffs in the following directories:
#   protocol/
#   go/
# We ignore shared as we run prettier and it's complicated to sync that up
# This build process is idempotent. We expect there to be no changes after
# re-running the protocol generation, because any changes should have been
# checked in.
if ! git diff --quiet --exit-code HEAD -- ./ ../go/; then
  git diff HEAD -- ./ ../go/;
  echo 'ERROR: `git diff` detected changes. The generated protocol files are stale.'
  exit 1
fi

echo 'SUCCESS: The generated protocol files are up to date.'
