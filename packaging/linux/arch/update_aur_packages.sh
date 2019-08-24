#! /usr/bin/env bash

# This relies on the AUR SSH credentials that ../test_all_credentials.sh tests.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"
source "$here/arch_common.sh"

build_root="$1"

git_url="aur@aur.archlinux.org:keybase-bin"
src_prefix="https://prerelease.keybase.io/linux_binaries/deb"

setup_arch_build $build_root $git_url $src_prefix
keybase_bin_repo="$build_root/arch/keybase-bin"

if git -C "$keybase_bin_repo" commit -am "version bump" ; then
  echo Pushing keybase-bin...
  git -C "$keybase_bin_repo" push origin master
else
  echo No changes in keybase-bin. Skipping push.
fi

# We used to also update the keybase-git package here, but apparently that was
# against AUR policy.
