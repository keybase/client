#!/usr/bin/env bash

set -f -u -e

DIRS=$(go list ./... | grep -v /vendor/ | sed -e 's/^github.com\/keybase\/client\/go\///' | sed -e 's/^keybase\/client\/go\///')

export KEYBASE_LOG_SETUPTEST_FUNCS=1

for i in $DIRS
do
	echo -n "$i......."
	(cd $i && go test -timeout 50m)
done
