#! /usr/bin/env bash

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

# RPM does not allow - in version numbers, and it doesn't know how to escape +
# in URLs. Sigh.
version="$(cat "$build_root/VERSION" | sed 's/[-+]/./g')"
echo "RPM version is '$version'."
mode="$(cat "$build_root/MODE")"

name="$("$here/../../binary_name.sh" "$mode")"

build_one_architecture() {
  echo "Making .rpm package for $rpm_arch."
  dest="$build_root/rpm/$rpm_arch"
  mkdir -p "$dest/SPECS"

  # The binaries fold uses debian arch names.
  binaries_path="$(realpath "$build_root/binaries/$debian_arch")"
  echo "binaries_path: $binaries_path"

  # RPM requires us to list every file included in the package. Using `find`
  # could backfire on us if we get weird whitespace in any filename, but
  # hopefully that will never happen. (Maintaining this list by hand would be
  # much worse.)
  files="$(cd "$binaries_path" && find -type f | sed 's/\.//')"

  if [ "$mode" = "production" ] ; then
    repo_url="http://dist.keybase.io/linux/rpm/repo/$rpm_arch"
  elif [ "$mode" = "prerelease" ] ; then
    repo_url="http://s3.amazonaws.com/prerelease.keybase.io/rpm/$rpm_arch"
  elif [ "$mode" = "staging" ] ; then
    # Note: This doesn't exist yet. But we need to be distinct from the
    # production URL, because we're moving to a model where we build a clean
    # repo every time, rather than adding to an existing one. (For S3
    # compatibility.)
    repo_url="http://dist.keybase.io/linux/rpm_staging/repo/$rpm_arch"
  else
    # We don't actually publish devel builds. This URL is a dream within a
    # dream.
    repo_url="http://dist.keybase.io/linux/rpm_devel/repo/$rpm_arch"
  fi

  spec="$dest/SPECS/keybase-$rpm_arch.spec"
  mkdir -p "$(dirname "$spec")"
  cat "$here/spec.template" \
    | sed "s/@@NAME@@/$name/" \
    | sed "s/@@VERSION@@/$version/" \
    | sed "s|@@BINARIES_PATH@@|$binaries_path|" \
    > "$spec"
  # Append the files list to the spec.
  echo -e "\n%files\n$files" >> "$spec"
  # Append the postinstall script to the spec.
  echo -e "\n%post -p /bin/bash" >> "$spec"
  cat "$here/postinst.template" \
    | sed "s|@@REPO_URL@@|$repo_url|" \
    | sed "s/@@SOURCE_LIST_NAME@@/$name/" \
    >> "$spec"

  rpmbuild --define "_topdir $dest" --target "$rpm_arch" -bb "$spec"
}

export rpm_arch=i386
export debian_arch=i386
build_one_architecture

export rpm_arch=x86_64
export debian_arch=amd64
build_one_architecture
