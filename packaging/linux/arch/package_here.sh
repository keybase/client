#! /bin/bash

set -e -u -o pipefail

cd "$(dirname "$BASH_SOURCE")"

client_root="$(git rev-parse --show-toplevel)"
kbfs_root="$(realpath "$client_root/../kbfs")"

mkdir -p src
ln -snf "$client_root" src/client
ln -snf "$kbfs_root" src/kbfs

makepkg -e "$@"
