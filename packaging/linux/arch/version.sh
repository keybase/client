#! /usr/bin/env bash

# The timestamps in our usual prerelease version numbers aren't very useful on
# Arch, because people build packages locally. Also pacaur gets upset when the
# version number changes from the beginning to the end of a build, see
# https://github.com/rmarquis/pacaur/issues/483. So we omit the timestamp from
# the version in the Arch packages. Note that `keybase version` will still have
# a timestamp; this shorter format only shows up in `pacman -Qi keybase-git`.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

base_version="$("$here/../../version.sh" production)"
commit="$(git -C "$here" rev-parse --short HEAD)"

echo "$base_version+$commit"
