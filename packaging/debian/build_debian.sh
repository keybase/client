#! /bin/bash

# Builds the keybase binary and packages it into two ".deb" files, one for i386
# and one for amd64. Takes a build directory as an argument, or creates one in
# /tmp. The package files are created there, in their respective folders.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

# Take the first argument, or a tmp dir if there is no first argument.
build_root="${1:-$(mktemp -d)}"

echo Building in: "$build_root"

build_one_architecture() {
  echo "building Go client for $GOARCH"
  dest="$build_root/$debian_arch"
  mkdir -p "$dest/build/usr/bin"
  mkdir -p "$dest/build/DEBIAN"

  # `go build` reads $GOARCH
  go build -o "$dest/build/usr/bin/keybase" github.com/keybase/client/go/keybase

  # TODO: Make `keybase --version` behave better.
  version="$("$dest/build/usr/bin/keybase" --version 2> /dev/null | cut -d " " -f 3 || true)"

  cat "$here/control.template" \
    | sed "s/@@VERSION@@/$version/" \
    | sed "s/@@ARCHITECTURE@@/$debian_arch/" \
    > "$dest/build/DEBIAN/control"
  cp "$here/postinst" "$dest/build/DEBIAN/"

  dpkg-deb --build "$dest/build" "$dest/keybase.deb"

  # Write the version number to a file for the caller's convenience.
  echo -n "$version" > "$dest/VERSION"
}

# Note that Go names the x86 architecture differently than Debian does, which
# is why we need these two variables.
export GOARCH=386
export debian_arch=i386
build_one_architecture

export GOARCH=amd64
export debian_arch=amd64
build_one_architecture
