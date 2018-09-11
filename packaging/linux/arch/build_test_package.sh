#! /usr/bin/env bash

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
source "$here/arch_common.sh"

build_root="$1"

git_url="https://aur.archlinux.org/keybase-bin.git"
src_prefix="."

setup_arch_build $build_root $git_url $src_prefix
keybase_bin_repo="$build_root/arch/keybase-bin"

cd $keybase_bin_repo
makepkg
