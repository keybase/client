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
  # Everything gets laid out in $dest as it should be on the filesystem. The
  # spec file is set up to copy from there
  dest="$build_root/keybase_dest/$rpm_arch"

  # `go build` reads $GOARCH
  echo "building Go client for $GOARCH"
  go build -o "$dest/usr/bin/keybase" github.com/keybase/client/go/keybase

  # TODO: Make `keybase --version` behave better.
  version="$("$dest/usr/bin/keybase" --version 2> /dev/null | cut -d " " -f 3 || true)"

  # The spec file is the same for both architectures, but it depends on
  # $version. No harm in writing it here, even though we'll rewrite it next
  # time through the loop.
  spec="$build_root/SPECS/keybase.spec"
  mkdir -p "$(dirname "$spec")"
  cat "$here/spec.template" | sed "s/@@VERSION@@/$version/" > "$spec"
  cat "$here/postinst" >> "$spec"

  rpmbuild --define "_topdir $build_root" --target "$rpm_arch" -bb "$spec"
}

export rpm_arch=i386
export GOARCH=386
build_one_architecture

export rpm_arch=x86_64
export GOARCH=amd64
build_one_architecture
