#!/usr/bin/env bash

set -f -u -e
DIRS=$(go list ./... | grep -v /vendor/ | sed -e 's/^github.com\/keybase\/client\/go\///')

export KEYBASE_LOG_SETUPTEST_FUNCS=1

for i in $DIRS; do
	if [ "$i" = "loopback" ]; then
		echo "Skipping loopback"
	fi

	echo -n "$i......."
	(cd $i && go test -timeout 50m)
done
