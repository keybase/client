#! /bin/bash

# Builds the keybase binary and packages it into two ".deb" files, one for i386
# and one for amd64. Takes a build directory as an argument, or creates one in
# /tmp. The package files are created there, in their respective folders.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

mode="$("$here/../build_mode.sh")"
binary_name="$("$here/../binary_name.sh")"
if [ "$mode" = "release" ] ; then
  go_tags="release"
elif [ "$mode" = "staging" ] ; then
  go_tags="staging"
else
  go_tags=""
fi

# Take the first argument as the build root, or a tmp dir if there is no first
# argument.
build_root="${1:-$(mktemp -d)}"

echo "Building $mode mode in $build_root"

build_one_architecture() {
  echo "building Go client for $GOARCH"
  dest="$build_root/$debian_arch"
  mkdir -p "$dest/build/usr/bin"
  mkdir -p "$dest/build/DEBIAN"

  # `go build` reads $GOARCH
  go build -tags "$go_tags" -o "$dest/build/usr/bin/$binary_name" github.com/keybase/client/go/keybase

  version="$("$here/../version.sh")"

  # Installed-Size is a required field in the control file. Without it Ubuntu
  # users will see warnings.
  size="$(du --summarize --block-size=1024 "$dest/build" | awk '{print $1}')"

  cat "$here/control.template" \
    | sed "s/@@NAME@@/$binary_name/" \
    | sed "s/@@VERSION@@/$version/" \
    | sed "s/@@ARCHITECTURE@@/$debian_arch/" \
    | sed "s/@@SIZE@@/$size/" \
    > "$dest/build/DEBIAN/control"
  cp "$here/postinst" "$dest/build/DEBIAN/"

  fakeroot dpkg-deb --build "$dest/build" "$dest/$binary_name.deb"

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
