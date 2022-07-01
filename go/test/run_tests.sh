#!/usr/bin/env bash

cd "$(dirname "$BASH_SOURCE")/.."

set -f -u -e

options=$(getopt c $*)
if [ $? -ne 0 ]; then
    echo "Incorrect options provided"
    exit 1
fi

for i
do
    case "$1" in
    -c)
        FLAGS=-c
        ;;
    esac
    shift
done

(cd citogo && go install)

# Log the Go version.
echo "Running tests on commit $(git rev-parse --short HEAD) with $(go version)."

DIRS=$(go list ./... | sed -e 's/^github.com\/keybase\/client\/go\///')

export KEYBASE_LOG_SETUPTEST_FUNCS=1

# Add libraries used in testing
go get "github.com/stretchr/testify/require"
go get "github.com/stretchr/testify/assert"

failures=()

branch=$(git rev-parse --abbrev-ref HEAD)
build_id=$(perl -e '{ print time }')

for i in $DIRS; do
  echo -n "$i......."
  if ! (cd $i && citogo --flakes 4 --fails 5 --branch $branch --build-id $build_id --prefix $i --timeout 150s) ; then
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
