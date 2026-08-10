#!/usr/bin/env bash
# Builds and runs cpp/tests/jsi-convert-bench.cpp twice -- once against this
# branch's bridge, once against origin/master's -- on a real Hermes runtime,
# replaying the corpus built by make-bench-corpus.mjs from a real mobile
# session's RPC traffic.
#
# Hermes comes from the already-installed iOS pod, which ships a macOS slice, so
# nothing has to be built from source. Development-only; not part of the shipped
# module.
#
# Usage: rnmodules/react-native-kb/scripts/bench-jsi-convert.sh [corpus] [iters]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CPP_DIR="$ROOT/rnmodules/react-native-kb/cpp"
PODS="$ROOT/shared/ios/Pods"
HERMES="$PODS/hermes-engine/destroot"
CORPUS="${1:-/tmp/kb-bench-corpus.bin}"
ITERS="${2:-5}"

# Sets MSGPACK_INCLUDE, fetching the headers if yarn hasn't unpacked them.
# shellcheck source=./msgpack-include.sh
source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"

for p in "$HERMES/include" \
         "$PODS/Headers/Public/React-callinvoker"; do
  test -d "$p" || { echo "missing $p -- run yarn and yarn ios:pod:install first" >&2; exit 1; }
done
test -f "$CORPUS" || {
  echo "missing corpus $CORPUS -- run:" >&2
  echo "  node $ROOT/rnmodules/react-native-kb/scripts/make-bench-corpus.mjs" >&2
  exit 1
}

# Deliberately not `mktemp -d`, which lands in $TMPDIR: binaries run from there
# measure consistently slower on macOS, enough to swamp the difference being
# measured.
WORK="$(mktemp -d /tmp/kb-bench.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

# The baseline is master's bridge, checked out to its own directory so the two
# builds each see their own react-native-kb.h.
mkdir -p "$WORK/baseline"
for f in react-native-kb.cpp react-native-kb.h msgpack-safe.hpp; do
  git -C "$ROOT" show "origin/master:rnmodules/react-native-kb/cpp/$f" > "$WORK/baseline/$f"
done

FRAMEWORKS="$HERMES/Library/Frameworks/macosx"
COMMON=(
  -std=c++20 -O2 -DNDEBUG -DMSGPACK_NO_BOOST
  -I "$MSGPACK_INCLUDE"
  -I "$HERMES/include"
  -I "$PODS/Headers/Public/React-callinvoker"
  -F "$FRAMEWORKS" -framework hermesvm
  -Wl,-rpath,"$FRAMEWORKS"
)

build() { # build <outfile> <src-dir> [extra flags...]
  local out="$1" dir="$2"; shift 2
  local srcs=("$dir/react-native-kb.cpp")
  # frame-parser.cpp only exists on the branch.
  [ -f "$dir/frame-parser.cpp" ] && srcs+=("$dir/frame-parser.cpp")
  clang++ "${COMMON[@]}" "$@" -I "$dir" \
    "${srcs[@]}" "$CPP_DIR/tests/jsi-convert-bench.cpp" -o "$out"
}

echo "building baseline (origin/master)..."
build "$WORK/bench-baseline" "$WORK/baseline" -DKB_BASELINE=1
echo "building branch..."
build "$WORK/bench-branch" "$CPP_DIR"

echo
"$WORK/bench-baseline" "$CORPUS" "$ITERS"
echo
"$WORK/bench-branch" "$CORPUS" "$ITERS"
