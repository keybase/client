#!/usr/bin/env bash
# Runs every native/bridge test suite, optionally under sanitizers, so the
# whole set is one command instead of five with different env vars.
#
#   ./scripts/test-native-all.sh              plain, fast (what CI runs)
#   ./scripts/test-native-all.sh --sanitize   plain, then ASan+UBSan, then TSan
#   ./scripts/test-native-all.sh --sanitize --skip-go     C++ only
#
# The C++ suites link no Go, so their sanitizer output is trustworthy. The Go
# suite gets -race plus cgocheck2 instead: the gomobile framework is prebuilt
# and uninstrumented, so a C++ sanitizer cannot see the Go runtime's
# happens-before edges. Pointing TSan at the real app is a separate exercise --
# use the "Keybase (TSan)" Xcode scheme, which ships the needed suppressions.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"

SANITIZE=no
SKIP_GO=no
for arg in "$@"; do
  case "$arg" in
  --sanitize) SANITIZE=yes ;;
  --skip-go) SKIP_GO=yes ;;
  -h | --help)
    sed -n '2,14p' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  *)
    echo "unknown argument: $arg (want --sanitize, --skip-go)" >&2
    exit 1
    ;;
  esac
done

FAILED=()

run() {
  local label="$1"
  shift
  echo
  echo "=============================================================="
  echo "  $label"
  echo "=============================================================="
  # Deliberately not fatal: one suite failing should not hide the results of
  # the rest. Every failure is replayed in the summary and sets the exit code.
  if "$@"; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    FAILED+=("$label")
  fi
}

cpp_suites() {
  local mode="$1"
  local tag="${2:-}"
  KB_SANITIZE="$mode" run "frame-parser $tag" "$HERE/test-framing.sh"
  KB_SANITIZE="$mode" run "engine-reset-backoff $tag" "$HERE/test-engine-reset-backoff.sh"
  # Needs macOS + a pod install for the Hermes framework; skipped elsewhere
  # rather than counted as a failure, and said out loud so a machine that
  # silently never runs it is not mistaken for a clean run.
  if [ "$(uname -s)" = Darwin ] &&
    [ -d "$ROOT/shared/ios/Pods/hermes-engine/destroot" ]; then
    KB_SANITIZE="$mode" run "jsi-convert $tag" "$HERE/test-jsi-convert.sh"
  else
    echo "SKIP: jsi-convert $tag (needs macOS + yarn ios:pod:install)"
  fi
}

cpp_suites none

if [ "$SANITIZE" = yes ]; then
  cpp_suites asan "[asan+ubsan]"
  # Separate pass: ASan and TSan cannot be linked into the same binary.
  cpp_suites tsan "[tsan]"
fi

# A subshell rather than `env -C`: the -C flag is missing from older coreutils
# and from BSD env, and this has to run on the Linux CI image too.
go_bind_test() {
  (cd "$ROOT/go" && go test "$@" ./bind/...)
}

if [ "$SKIP_GO" = no ]; then
  run "go/bind -race" go_bind_test -race -count=1
  if [ "$SANITIZE" = yes ]; then
    # cgocheck2 catches Go pointers passed into C -- the exact hazard the
    # shared read buffer and WriteArr's defensive copy exist to avoid.
    run "go/bind -race cgocheck2" \
      env GOEXPERIMENT=cgocheck2 GODEBUG=clobberfree=1 \
      bash -c "cd '$ROOT/go' && go test -race -count=1 ./bind/..."
    # Repeat runs shake out races that only lose the schedule sometimes.
    run "go/bind -race x20" go_bind_test -race -count=20
  fi
fi

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "all suites passed"
  exit 0
fi
echo "FAILED suites:"
for f in "${FAILED[@]}"; do echo "  - $f"; done
exit 1
