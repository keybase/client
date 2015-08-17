#! /bin/bash

# Builds the keybase binary and packages it into two ".deb" files, one for i386
# and one for amd64. Takes a build directory as an argument, or creates one in
# /tmp. The package files are created there, in their respective folders.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

# Take the first argument, or a tmp dir if there is no first argument.
build_root="${1:-$(mktemp -d)}"

echo Building in: "$build_root"

# Everything gets laid out in here as it should be on the filesystem. The spec
# file is set up to copy from here.
dest="$build_root/keybase_dest"

# `go build` reads $GOARCH
go build -o "$dest/usr/bin/keybase" github.com/keybase/client/go/keybase

# TODO: Make `keybase --version` behave better.
version="$("$dest/usr/bin/keybase" --version 2> /dev/null | cut -d " " -f 3 || true)"

rpmbuild --define "_topdir $build_root" -bb "$here/spec"
