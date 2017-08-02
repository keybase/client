#! /usr/bin/env bash

# This relies on the AUR SSH credentials that ../test_all_credentials.sh tests.

set -e -u -o pipefail

# build_binaries.sh and deb/package_binaries.sh must already have been run on
# this build root.
build_root="$1"
here="$(dirname "$BASH_SOURCE")"

mkdir -p "$build_root/arch"

clone_maybe() {
  if [ ! -e "$2" ] ; then
    git clone "$1" "$2"
  fi
}

###
### keybase-bin
###

keybase_bin_repo="$build_root/arch/keybase-bin"
clone_maybe "aur@aur.archlinux.org:keybase-bin" "$keybase_bin_repo"

cp "$here/keybase.install" "$keybase_bin_repo"

# Arch doesn't allow dashes in its version numbers.
pkgver="$(cat "$build_root/VERSION" | sed s/-/_/)"

# Debian replaces the + with a . to avoid URL mangling.
# Note that we've duplicated this logic in the PKGBUILD, to make our diffs
# nicer, as per "Eschwartz commented on 2017-07-28 20:41" at
# https://aur.archlinux.org/packages/keybase-bin.
debver="$(cat "$build_root/VERSION" | sed s/+/./)"

deb_i386="$(ls "$build_root"/deb/i386/*.deb)"
sum_i386="$(sha256sum "$deb_i386" | awk '{print $1}')"

deb_amd64="$(ls "$build_root"/deb/amd64/*.deb)"
sum_amd64="$(sha256sum "$deb_amd64" | awk '{print $1}')"

cat "$here/PKGBUILD.bin.in" \
  | sed "s/@@PKGVER@@/$pkgver/g" \
  | sed "s/@@SUM_i686@@/$sum_i386/g" \
  | sed "s/@@SUM_x86_64@@/$sum_amd64/g" \
  > "$keybase_bin_repo/PKGBUILD"

cat "$here/DOT_SRCINFO.bin.in" \
  | sed "s/@@PKGVER@@/$pkgver/g" \
  | sed "s/@@DEBVER@@/$debver/g" \
  | sed "s/@@SUM_i686@@/$sum_i386/g" \
  | sed "s/@@SUM_x86_64@@/$sum_amd64/g" \
  > "$keybase_bin_repo/.SRCINFO"

if git -C "$keybase_bin_repo" commit -am "version bump" ; then
  echo Pushing keybase-bin...
  git -C "$keybase_bin_repo" push origin master
else
  echo No changes in keybase-bin. Skipping push.
fi

# We used to also update the keybase-git package here, but apparently that was
# against AUR policy.
