#!/usr/bin/env bash

cd "$(dirname "$BASH_SOURCE")/.."

set -f -u -e

# Log the Go version.
echo "Running tests on commit $(git rev-parse --short HEAD) with $(go version)."

DIRS=$(go list ./... | grep -v /vendor/ | sed -e 's/^github.com\/keybase\/client\/go\///')

export KEYBASE_LOG_SETUPTEST_FUNCS=1
export KEYBASE_RUN_CI=1

# Add libraries used in testing
go get "github.com/stretchr/testify/require"
go get "github.com/stretchr/testify/assert"

failures=()

for i in $DIRS; do
  if [ "$i" = "bind" ]; then
    echo "Skipping bind"
    continue
  fi

  echo -n "$i......."
  if ! (cd $i && go test -timeout 50m -ldflags -s) ; then
    failures+=("$i")
  fi
done

echo
if [ "${#failures[@]}" -ne 0 ] ; then
  echo FAILURES:
  for failure in "${failures[@]}" ; do
    echo "  $failure"
  done
  exit 1
else
  echo SUCCESS
  exit 0
fi
