#!/usr/bin/env bash
# Sourced, not executed. Sets MSGPACK_INCLUDE to the vendored msgpack-cxx
# headers that `yarn modules` unpacks into shared/node_modules. This script
# never downloads anything -- if the headers aren't there it errors out and
# tells you to run `yarn modules`.
#
# Usage:  source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"
#         ... then use "$MSGPACK_INCLUDE"

# Keep in sync with getMsgPack() in shared/desktop/yarn-helper/index.mts.
MSGPACK_VER=7.0.0

_MSGPACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MSGPACK_INCLUDE="$_MSGPACK_ROOT/shared/node_modules/msgpack-cxx-$MSGPACK_VER/include"

if [ ! -d "$MSGPACK_INCLUDE" ]; then
  echo "missing $MSGPACK_INCLUDE" >&2
  echo "msgpack-cxx is not in node_modules -- run 'yarn modules' from shared/" >&2
  exit 1
fi
