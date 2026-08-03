#!/usr/bin/env bash
# The single place msgpack-cxx headers are obtained. Sets MSGPACK_INCLUDE to
# shared/node_modules/msgpack-cxx-$MSGPACK_VER/include, downloading and
# unpacking the release tarball there if it isn't already present.
#
# Both a sourceable library and a standalone command:
#   source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"  # then use "$MSGPACK_INCLUDE"
#   ./msgpack-include.sh                                        # ensure, then print the path
#
# yarn's postinstall (getMsgPack in shared/desktop/yarn-helper/index.mts) shells
# out to this, so a normal `yarn modules` leaves the headers in node_modules and
# every other caller hits the no-op path.

MSGPACK_VER=7.0.0
MSGPACK_SHA1=37bbdbf69ef44392c7af215b9cb419891a9e1c9c

_MSGPACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
_MSGPACK_MODULES="$_MSGPACK_ROOT/shared/node_modules"
_MSGPACK_FILE="msgpack-cxx-$MSGPACK_VER.tar.gz"
_MSGPACK_CACHE="$_MSGPACK_MODULES/.cache"
MSGPACK_INCLUDE="$_MSGPACK_MODULES/msgpack-cxx-$MSGPACK_VER/include"

# shasum on macOS, sha1sum on the Linux CI images.
_msgpack_sha1_ok() {
  local got
  if command -v shasum >/dev/null 2>&1; then
    got="$(shasum -a 1 "$1" | awk '{print $1}')"
  else
    got="$(sha1sum "$1" | awk '{print $1}')"
  fi
  [ "$got" = "$MSGPACK_SHA1" ]
}

_msgpack_ensure() {
  [ -d "$MSGPACK_INCLUDE" ] && return 0

  local tarball="$_MSGPACK_CACHE/$_MSGPACK_FILE"
  mkdir -p "$_MSGPACK_CACHE"
  if [ ! -f "$tarball" ] || ! _msgpack_sha1_ok "$tarball"; then
    rm -f "$tarball"
    echo "fetching msgpack-cxx $MSGPACK_VER" >&2
    curl -fsSL -o "$tarball" \
      "https://github.com/msgpack/msgpack-c/releases/download/cpp-$MSGPACK_VER/$_MSGPACK_FILE" || return 1
  fi
  if ! _msgpack_sha1_ok "$tarball"; then
    echo "msgpack-cxx $MSGPACK_VER checksum mismatch, refusing to unpack" >&2
    rm -f "$tarball"
    return 1
  fi
  tar -xf "$tarball" -C "$_MSGPACK_MODULES"
}

if ! _msgpack_ensure || [ ! -d "$MSGPACK_INCLUDE" ]; then
  echo "could not obtain $MSGPACK_INCLUDE" >&2
  exit 1
fi

# Executed rather than sourced: print the path so callers can capture it.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  echo "$MSGPACK_INCLUDE"
fi
