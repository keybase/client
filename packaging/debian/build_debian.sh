#! /bin/bash

set -e -u -o pipefail

cd "$(dirname "$BASH_SOURCE")"

# Builds `keybase` in the current directory.
echo "building Go client"
go build github.com/keybase/client/go/keybase

# TODO: Make `keybase --version` behave better.
version="$(./keybase --version 2> /dev/null | cut -d " " -f 3 || true)"

mkdir -p build/usr/bin
mv keybase build/usr/bin/

mkdir -p build/DEBIAN
cat control.template | sed "s/@@VERSION@@/$version/" > build/DEBIAN/control

debname="keybase-${version}.deb"
dpkg-deb --build build "$debname"
