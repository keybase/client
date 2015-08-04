#! /bin/bash

set -e -u -o pipefail

cd "$(dirname "$BASH_SOURCE")"

# Builds `keybase` in the current directory.
echo "building Go client"
go install github.com/keybase/client/go/keybase

# TODO: Make `keybase --version` behave better.
version="$($GOPATH/bin/keybase --version 2> /dev/null | cut -d " " -f 3 || true)"

mkdir -p build/usr/bin
cp "$GOPATH/bin/keybase" build/usr/bin/

mkdir -p build/DEBIAN
cat control.template | sed "s/@@VERSION@@/$version/" > build/DEBIAN/control

debname="keybase-${version}.deb"
dpkg-deb --build build "$debname"
