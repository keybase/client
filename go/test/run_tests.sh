#!/usr/bin/env bash

set -f -u -e

DIRS=$(go list ./... | grep -v /vendor/ | sed -e 's/^github.com\/keybase\/client\/go\///' | sed -e 's/^_home\/ubuntu\/client\/go\//')

for i in $DIRS
do
	echo -n "$i......."
	(cd $i && go test -timeout 30m)
done
