#! /usr/bin/env bash

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
cd "$here"

# First let's get the index clean from other files that CI runs
git add -A ./ ../go/ ../shared/

npm i
make clean
make

cd ../shared
yarn add --pure-lockfile prettier
yarn run prettier -- --write ../protocol/js/*.js shared/constants/types/*.js
cd "$here"

# Protocol changes could create diffs in the following directories:
#   protocol/
#   go/
#   shared/
# This build process is idempotent. We expect there to be no changes after
# re-running the protocol generation, because any changes should have been
# checked in.
if ! git diff --quiet --exit-code HEAD -- ./ ../go/ ../shared/; then
  git diff HEAD -- ./ ../go/ ../shared/;
  echo 'ERROR: `git diff` detected changes. The generated protocol files are stale.'
  exit 1
fi

echo 'SUCCESS: The generated protocol files are up to date.'
