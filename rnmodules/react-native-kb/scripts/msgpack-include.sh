#!/usr/bin/env bash
# Sourced, not executed. Sets MSGPACK_INCLUDE to the vendored msgpack-cxx
# headers, fetching them first if they aren't unpacked yet.
#
# shared/desktop/yarn-helper/index.mts's getMsgPack() only unpacks these on
# darwin (they exist for the iOS pod), so on a Linux CI box `yarn` leaves them
# absent. Anything that compiles the C++ bridge outside Xcode needs them on
# every platform, so the fetch lives here -- one copy of the version+shasum,
# shared by every script under this directory.
#
# Usage:  source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"
#         ... then use "$MSGPACK_INCLUDE"

# Keep in sync with getMsgPack() in shared/desktop/yarn-helper/index.mts.
MSGPACK_VER=7.0.0
MSGPACK_SHA=37bbdbf69ef44392c7af215b9cb419891a9e1c9c

_MSGPACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
_MSGPACK_DEST="$_MSGPACK_ROOT/shared/node_modules"
MSGPACK_INCLUDE="$_MSGPACK_DEST/msgpack-cxx-$MSGPACK_VER/include"

if [ ! -d "$MSGPACK_INCLUDE" ]; then
  _MSGPACK_TARBALL="msgpack-cxx-$MSGPACK_VER.tar.gz"
  # macOS ships shasum, most Linux images ship only sha1sum.
  _MSGPACK_SHACMD=shasum
  command -v shasum >/dev/null 2>&1 || _MSGPACK_SHACMD=sha1sum
  mkdir -p "$_MSGPACK_DEST/.cache"
  if [ ! -f "$_MSGPACK_DEST/.cache/$_MSGPACK_TARBALL" ]; then
    echo "fetching $_MSGPACK_TARBALL..."
    curl -sSfL -o "$_MSGPACK_DEST/.cache/$_MSGPACK_TARBALL" \
      "https://github.com/msgpack/msgpack-c/releases/download/cpp-$MSGPACK_VER/$_MSGPACK_TARBALL"
  fi
  (
    cd "$_MSGPACK_DEST" &&
      echo "$MSGPACK_SHA *.cache/$_MSGPACK_TARBALL" | "$_MSGPACK_SHACMD" -c &&
      tar -xf ".cache/$_MSGPACK_TARBALL"
  )
  test -d "$MSGPACK_INCLUDE" || {
    echo "missing $MSGPACK_INCLUDE -- msgpack-cxx fetch/untar failed" >&2
    exit 1
  }
fi
