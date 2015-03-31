#!/bin/sh

set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

VERSION="$@"

if [ "$VERSION" = "" ]; then
	echo "Specify version."
	exit 1
fi

echo "Version: $VERSION"

github-markup notes/Keybase-$VERSION.md > site/Keybase-$VERSION.html

ruby appcast.rb $@
