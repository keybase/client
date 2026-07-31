#!/usr/bin/env bash
# Builds and runs the msgpack <-> JSI correctness tests
# (rnmodules/react-native-kb/cpp/tests/jsi-convert-test.cpp) against a real
# Hermes runtime.
#
# Hermes comes from the already-installed iOS pod, which ships a macOS slice,
# so nothing has to be built from source -- the same arrangement
# scripts/bench-jsi-convert.sh uses. Development-only; not part of the shipped
# module.
#
# Exits nonzero if any test case fails.
#
# Run it by hand on a mac before touching the conversion code: hermesvm.framework
# is a prebuilt Mach-O framework vendored by the hermes-engine CocoaPod, so this
# needs macOS + Xcode + `yarn ios:pod:install`.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CPP_DIR="$ROOT/rnmodules/react-native-kb/cpp"
PODS="$ROOT/shared/ios/Pods"
HERMES="$PODS/hermes-engine/destroot"

# Sets MSGPACK_INCLUDE, fetching the headers if yarn hasn't unpacked them.
# shellcheck source=./msgpack-include.sh
source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"

for p in "$MSGPACK_INCLUDE" "$HERMES/include" \
         "$PODS/Headers/Public/React-callinvoker"; do
  test -d "$p" || {
    echo "missing $p -- run yarn and yarn ios:pod:install first" >&2
    exit 1
  }
done

FRAMEWORKS="$HERMES/Library/Frameworks/macosx"
test -d "$FRAMEWORKS/hermesvm.framework" || {
  echo "missing $FRAMEWORKS/hermesvm.framework -- run yarn ios:pod:install" >&2
  exit 1
}

WORK="$(mktemp -d /tmp/kb-jsi-test.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

# jsi-convert-test.cpp #includes react-native-kb.cpp (it needs at the
# anonymous-namespace packNumber), so that file must NOT also be compiled
# separately here or every symbol would be defined twice.
# Sets SANITIZE_FLAGS from KB_SANITIZE (empty unless opted in). CXX/CXX_STD are
# hardcoded to clang++/c++20 here (this script is macOS-only by construction),
# but sanitize-flags.sh probes $CXX, so give it those values.
CXX=clang++ CXX_STD=-std=c++20
# shellcheck source=./sanitize-flags.sh
source "$(dirname "${BASH_SOURCE[0]}")/sanitize-flags.sh"

clang++ -std=c++20 -O1 -g -DMSGPACK_NO_BOOST \
  -Wall -Wextra -Wno-unused-function "${SANITIZE_FLAGS[@]+"${SANITIZE_FLAGS[@]}"}" \
  -I "$MSGPACK_INCLUDE" \
  -I "$HERMES/include" \
  -I "$PODS/Headers/Public/React-callinvoker" \
  -I "$CPP_DIR" \
  -F "$FRAMEWORKS" -framework hermesvm \
  -Wl,-rpath,"$FRAMEWORKS" \
  "$CPP_DIR/frame-parser.cpp" \
  "$CPP_DIR/tests/jsi-convert-test.cpp" \
  -o "$WORK/jsi-convert-test"

"$WORK/jsi-convert-test"
