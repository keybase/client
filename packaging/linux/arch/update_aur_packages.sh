#! /usr/bin/env bash

# This relies on the AUR SSH credentials that ../test_all_credentials.sh tests.

set -e -u -o pipefail

# build_binaries.sh and deb/package_binaries.sh must already have been run on
# this build root.
build_root="$1"
here="$(dirname "$BASH_SOURCE")"

# Arch doesn't allow dashes in its version numbers.
pkgver="$(cat "$build_root/VERSION" | sed s/-/_/)"
echo PKGVER $pkgver

mkdir -p "$build_root/arch"

clone_maybe() {
  if [ ! -e "$2" ] ; then
    git clone "$1" "$2"
  fi
}

# Clone the repo for Arch's mksrcinfo tool. Thankfully no dependencies here.
introspection_repo="$build_root/arch/pkgbuild-introspection"
clone_maybe "https://github.com/falconindy/pkgbuild-introspection" "$introspection_repo"
make -C "$introspection_repo"

###
### keybase-bin
###

keybase_bin_repo="$build_root/arch/keybase-bin"
clone_maybe "aur@aur.archlinux.org:keybase-bin" "$keybase_bin_repo"

cp "$here/keybase.install" "$keybase_bin_repo"

sed "s/@@PKGVER@@/$pkgver/" < "$here/PKGBUILD.bin.in" > "$keybase_bin_repo/PKGBUILD"

deb_i386="$(ls "$build_root"/deb/i386/*.deb)"
i386_sum="$(sha256sum "$deb_i386" | awk '{print $1}')"
echo "sha256sums_i686=($i386_sum)" >> "$keybase_bin_repo/PKGBUILD"

deb_amd64="$(ls "$build_root"/deb/amd64/*.deb)"
amd64_sum="$(sha256sum "$deb_amd64" | awk '{print $1}')"
echo "sha256sums_x86_64=($amd64_sum)" >> "$keybase_bin_repo/PKGBUILD"

(cd "$keybase_bin_repo" &&
  "$introspection_repo/mksrcinfo" &&
  git commit -am "version bump" &&
  git push)

###
### keybase-git
###

keybase_git_repo="$build_root/arch/keybase-git"
clone_maybe "aur@aur.archlinux.org:keybase-git" "$keybase_git_repo"

cp "$here/keybase.install" "$keybase_git_repo"

sed "s/@@PKGVER@@/$pkgver/" < "$here/PKGBUILD.git.in" > "$keybase_git_repo/PKGBUILD"

(cd "$keybase_git_repo" &&
  "$introspection_repo/mksrcinfo" &&
  git commit -am "version bump" &&
  git push)
