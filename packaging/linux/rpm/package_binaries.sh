#! /bin/bash

# Builds the keybase binary and packages it into two ".rpm" files, one for i386
# and one for amd64. The argument to this script is the output directory of a
# build_binaries.sh build. The package files are created there, in their
# respective architecture folders.
#
# Usage:
#   ./package_binaries.sh <build_root>

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

build_root="${1:-}"
if [ -z "$build_root" ] ; then
  echo 'Usage:  ./package_binaries.sh <build_root>'
  exit 1
fi

# RPM does not allow - in version numbers. Sigh.
version="$(cat "$build_root/VERSION" | sed 's/-/./')"
echo "RPM version is '$version'."
mode="$(cat "$build_root/MODE")"

name="$("$here/../../binary_name.sh" "$mode")"

# TODO: Add a prerelease RPM repo URL.

build_one_architecture() {
  echo "Making .rpm package for $rpm_arch."
  # The folders in the build root use Debian arch names.
  dest="$build_root/$debian_arch/rpm"
  mkdir -p "$dest/SPECS"

  # The spec file contains commands for copying binaries.

  spec="$dest/SPECS/keybase-$rpm_arch.spec"
  mkdir -p "$(dirname "$spec")"
  cat "$here/spec.template" \
    | sed "s/@@NAME@@/$name/" \
    | sed "s/@@VERSION@@/$version/" \
    > "$spec"
  cat "$here/postinst.template" | sed "s/@@ARCH@@/$rpm_arch/" >> "$spec"

  rpmbuild --define "_topdir $dest" --target "$rpm_arch" -bb "$spec"
}

export rpm_arch=i386
export debian_arch=i386
export electron_arch=ia32
export GOARCH=386
build_one_architecture

export rpm_arch=x86_64
export debian_arch=amd64
export electron_arch=x64
export GOARCH=amd64
build_one_architecture
