#!/usr/bin/env bash
# Builds and runs the FrameParser unit tests
# (rnmodules/react-native-kb/cpp/tests/frame-parser-test.cpp). No JS runtime
# or JSI headers are needed -- FrameParser has no jsi/React dependency -- so
# this only needs a plain msgpack-cxx include path, the same one used for the
# react-native-kb.cpp syntax-only clang++ check.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CPP_DIR="$ROOT/rnmodules/react-native-kb/cpp"
MSGPACK_INCLUDE="$ROOT/shared/node_modules/msgpack-cxx-7.0.0/include"
test -d "$MSGPACK_INCLUDE" || {
  echo "missing $MSGPACK_INCLUDE — run yarn in shared/ first" >&2
  exit 1
}

BIN="$(mktemp -d)/frame-parser-test"
trap 'rm -rf "$(dirname "$BIN")"' EXIT

clang++ -std=c++20 -O1 -g -DMSGPACK_NO_BOOST \
  -Wall -Wextra \
  -I "$MSGPACK_INCLUDE" \
  "$CPP_DIR/frame-parser.cpp" \
  "$CPP_DIR/tests/frame-parser-test.cpp" \
  -o "$BIN"

"$BIN"
