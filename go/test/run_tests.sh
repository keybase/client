#!/usr/bin/env bash

set -f -u -e
go list ./...

DIRS=$(go list ./... | grep -v /vendor/ | sed -e 's/^github.com\/keybase\/client\/go\///')

for i in $DIRS
do
	echo -n "$i......."
	(cd $i && go test -timeout 30m)
done
