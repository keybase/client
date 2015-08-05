#! /bin/bash

# Builds the keybase binary and packages it into a ".deb" file. Takes a build
# directory as an argument, or creates one in /tmp. The package file is written
# to that directory.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

# Take the first argument, or a tmp dir if there is no first argument.
dest="${1:-$(mktemp -d)}"

echo Building in: "$dest"

# Build the `keybase` binary inside $GOPATH.
echo "building Go client"
go install github.com/keybase/client/go/keybase

# TODO: Make `keybase --version` behave better.
version="$($GOPATH/bin/keybase --version 2> /dev/null | cut -d " " -f 3 || true)"

mkdir -p "$dest/build/usr/bin"
cp "$GOPATH/bin/keybase" "$dest/build/usr/bin/"

mkdir -p "$dest/build/DEBIAN"
cat "$here/control.template" | sed "s/@@VERSION@@/$version/" > "$dest/build/DEBIAN/control"
cp "$here/postinst" "$dest/build/DEBIAN/"

debfile="$dest/keybase-${version}.deb"
dpkg-deb --build "$dest/build" "$debfile"
