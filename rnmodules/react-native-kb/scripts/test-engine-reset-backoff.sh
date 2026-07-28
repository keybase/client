#!/usr/bin/env bash
# Builds and runs the kb-engine-reset emit-backoff unit tests
# (rnmodules/react-native-kb/cpp/tests/engine-reset-backoff-test.cpp).
#
# engine-reset-backoff.h is header-only and depends on nothing at all -- no
# jsi/React, not even msgpack -- so unlike test-framing.sh this needs only a
# C++ compiler and no vendored headers.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CPP_DIR="$ROOT/rnmodules/react-native-kb/cpp"

# clang++ locally / on the mac builders, g++ on the Linux CI image.
CXX="${CXX:-}"
if [ -z "$CXX" ]; then
  if command -v clang++ >/dev/null 2>&1; then CXX=clang++; else CXX=g++; fi
fi

BIN="$(mktemp -d)/engine-reset-backoff-test"
trap 'rm -rf "$(dirname "$BIN")"' EXIT

"$CXX" -std=c++20 -O1 -g -Wall -Wextra \
  "$CPP_DIR/tests/engine-reset-backoff-test.cpp" \
  -o "$BIN"

"$BIN"
