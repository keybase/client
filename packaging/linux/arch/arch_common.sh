#! /usr/bin/env bash

clone_maybe() {
  if [ ! -e "$2" ] ; then
    git clone "$1" "$2"
  fi
}

setup_arch_build() {
    build_root="$1"
    git_url="$2"
    src_prefix="$3"

    # build_binaries.sh and deb/package_binaries.sh must already have
    # been run on this build root.
    here="$(dirname "$BASH_SOURCE")"

    mkdir -p "$build_root/arch"

    keybase_bin_repo="$build_root/arch/keybase-bin"
    clone_maybe "$git_url" "$keybase_bin_repo"

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

    if [ "$src_prefix" = "." ]; then
        cp $deb_i386 $keybase_bin_repo/keybase_${debver}_i386.deb
        cp $deb_amd64 $keybase_bin_repo/keybase_${debver}_amd64.deb
    fi

    cat "$here/PKGBUILD.bin.in" \
        | sed "s/@@PKGVER@@/$pkgver/g" \
        | sed "s/@@SUM_i686@@/$sum_i386/g" \
        | sed "s/@@SUM_x86_64@@/$sum_amd64/g" \
        | sed "s|@@SRC_PREFIX@@|$src_prefix|g" \
              > "$keybase_bin_repo/PKGBUILD"

    cat "$here/DOT_SRCINFO.bin.in" \
        | sed "s/@@PKGVER@@/$pkgver/g" \
        | sed "s/@@DEBVER@@/$debver/g" \
        | sed "s/@@SUM_i686@@/$sum_i386/g" \
        | sed "s/@@SUM_x86_64@@/$sum_amd64/g" \
        | sed "s|@@SRC_PREFIX@@|$src_prefix|g" \
              > "$keybase_bin_repo/.SRCINFO"
}
