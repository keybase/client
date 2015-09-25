#! /bin/bash

# Builds the keybase binary and packages it into two ".deb" files, one for i386
# and one for amd64. Takes a build directory as an argument, or creates one in
# /tmp. The package files are created there, in their respective folders.
#
# Usage:
#   ./build_rpm.sh (release|staging|devel) [build_dir]

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

mode="$("$here/../build_mode.sh" "$@")"
binary_name="$("$here/../binary_name.sh" "$@")"
if [ "$mode" = "release" ] ; then
  go_tags="release"
elif [ "$mode" = "staging" ] ; then
  go_tags="staging"
else
  go_tags=""
fi

# Take the second argument, or a tmp dir if there is no first argument.
build_root="${2:-$(mktemp -d)}"

echo "Building $mode mode in $build_root"

build_one_architecture() {
  # Everything gets laid out in $dest as it should be on the filesystem. The
  # spec file is set up to copy from there
  dest="$build_root/keybase_dest/$rpm_arch"

  echo "building Go client for $GOARCH"

  # `go build` reads $GOARCH
  # XXX: Go does not build tags reliably prior to 1.5 without -a. See:
  #      https://github.com/golang/go/issues/11165
  go build -a -tags "$go_tags" -o "$dest/usr/bin/$binary_name" github.com/keybase/client/go/keybase

  # RPM does not allow - in version numbers. Sigh.
  version="$("$here/../version.sh" | sed 's/-/./')"
  echo version is $version

  spec="$build_root/SPECS/keybase-$rpm_arch.spec"
  mkdir -p "$(dirname "$spec")"
  cat "$here/spec.template" \
    | sed "s/@@NAME@@/$binary_name/" \
    | sed "s/@@VERSION@@/$version/" \
    > "$spec"
  cat "$here/postinst.template" | sed "s/@@ARCH@@/$rpm_arch/" >> "$spec"

  rpmbuild --define "_topdir $build_root" --target "$rpm_arch" -bb "$spec"
}

export rpm_arch=i386
export GOARCH=386
build_one_architecture

export rpm_arch=x86_64
export GOARCH=amd64
build_one_architecture
