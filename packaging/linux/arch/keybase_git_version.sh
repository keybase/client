#! /usr/bin/env bash

# The timestamps in our usual prerelease version numbers don't make sense for
# the keybase-git Arch package. Also pacaur gets upset when the version number
# changes from the beginning to the end of a build, see
# https://github.com/rmarquis/pacaur/issues/483. Note that `keybase version`
# will still have a timestamp; this shorter format only shows up in `pacman -Qi
# keybase-git`.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

base_version="$("$here/../../version.sh" production)"
commit_count="$(git -C "$here" rev-list --count HEAD)"
commit_hash="$(git -C "$here" rev-parse --short HEAD)"

echo "$base_version+$commit_count.$commit_hash"
