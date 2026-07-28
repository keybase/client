#!/usr/bin/env bash
# Builds and runs the FrameParser unit tests
# (rnmodules/react-native-kb/cpp/tests/frame-parser-test.cpp). No JS runtime
# or JSI headers are needed -- FrameParser has no jsi/React dependency -- so
# this only needs a plain msgpack-cxx include path, the same one used for the
# react-native-kb.cpp syntax-only clang++ check.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CPP_DIR="$ROOT/rnmodules/react-native-kb/cpp"
# Sets MSGPACK_INCLUDE, fetching the headers if yarn hasn't unpacked them.
# shellcheck source=./msgpack-include.sh
source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"

# Sets CXX and CXX_STD (-std=c++20, or -std=c++2a on the older CI g++).
# shellcheck source=./cxx-select.sh
source "$(dirname "${BASH_SOURCE[0]}")/cxx-select.sh"

BIN="$(mktemp -d)/frame-parser-test"
trap 'rm -rf "$(dirname "$BIN")"' EXIT

"$CXX" "$CXX_STD" -O1 -g -DMSGPACK_NO_BOOST \
  -Wall -Wextra \
  -I "$MSGPACK_INCLUDE" \
  "$CPP_DIR/frame-parser.cpp" \
  "$CPP_DIR/tests/frame-parser-test.cpp" \
  -o "$BIN"

"$BIN"
