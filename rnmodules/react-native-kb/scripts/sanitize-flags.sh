#!/usr/bin/env bash
# Sourced, not executed. Reads KB_SANITIZE and sets:
#   SANITIZE_FLAGS -- array of compiler flags to splice into the build line
# and exports the matching *SAN_OPTIONS so a failure aborts instead of
# printing a report and exiting 0.
#
# KB_SANITIZE values:
#   (unset) or none   no instrumentation -- the default, what CI runs
#   asan              AddressSanitizer + LeakSanitizer + UBSan
#   ubsan             UBSan alone (cheap enough to pair with anything)
#   tsan              ThreadSanitizer -- mutually exclusive with asan
#
# Usage:  source "$(dirname "${BASH_SOURCE[0]}")/sanitize-flags.sh"
#         "$CXX" "$CXX_STD" "${SANITIZE_FLAGS[@]}" ...
#
# These only apply to the standalone C++ test binaries, which link no Go. The
# gomobile framework is prebuilt and uninstrumented, so a sanitizer cannot see
# the Go runtime's happens-before edges -- pointing TSan at the real app is a
# different exercise (see the Keybase TSan/ASan schemes) and needs suppressions.

SANITIZE_FLAGS=()
_KB_SAN="${KB_SANITIZE:-none}"

# libc++/libstdc++ bounds and iterator checking. Independent of the sanitizers
# and worth having under any of them: FrameParser is all offset arithmetic over
# spans, which is exactly what hardening catches and ASan alone can miss when
# the bad index still lands inside the allocation.
_kb_harden() {
  # Match on --version output, not the binary name: "clang++" ends in "g++",
  # so any suffix test on the name misidentifies it.
  if "$CXX" --version 2>/dev/null | head -1 | grep -qi clang; then
    # Modern libc++ spells it HARDENING_MODE; older releases only had
    # _LIBCPP_DEBUG and reject this. Probe rather than switch on version.
    if echo 'int main(){}' | "$CXX" "$CXX_STD" \
      -D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_DEBUG \
      -x c++ - -o /dev/null >/dev/null 2>&1; then
      SANITIZE_FLAGS+=(-D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_DEBUG)
    fi
  else
    SANITIZE_FLAGS+=(-D_GLIBCXX_ASSERTIONS)
  fi
}

case "$_KB_SAN" in
none) ;;
asan)
  SANITIZE_FLAGS+=(
    -fsanitize=address,undefined
    -fno-sanitize-recover=all
    -fsanitize-address-use-after-scope
    -fno-omit-frame-pointer
    -g
  )
  _kb_harden
  # LeakSanitizer does not exist on Darwin, and asking for it there is fatal
  # ("detect_leaks is not supported on this platform" + abort), not ignored.
  _kb_leaks=0
  [ "$(uname -s)" = Linux ] && _kb_leaks=1
  export ASAN_OPTIONS="detect_leaks=$_kb_leaks:abort_on_error=1:detect_stack_use_after_return=1:strict_string_checks=1:check_initialization_order=1"
  export UBSAN_OPTIONS="print_stacktrace=1:halt_on_error=1"
  # ASan and the macOS nano malloc zone do not coexist; without this the
  # runtime prints a "malloc zone" warning on every launch.
  export MallocNanoZone=0
  ;;
ubsan)
  SANITIZE_FLAGS+=(
    -fsanitize=undefined
    -fno-sanitize-recover=all
    -fno-omit-frame-pointer
    -g
  )
  _kb_harden
  export UBSAN_OPTIONS="print_stacktrace=1:halt_on_error=1"
  ;;
tsan)
  SANITIZE_FLAGS+=(
    -fsanitize=thread
    -fno-omit-frame-pointer
    -g
  )
  _kb_harden
  export TSAN_OPTIONS="halt_on_error=1:second_deadlock_stack=1:history_size=7"
  ;;
*)
  echo "KB_SANITIZE=$_KB_SAN not recognized (want: none, asan, ubsan, tsan)" >&2
  exit 1
  ;;
esac

if [ "$_KB_SAN" != none ]; then
  echo "==> KB_SANITIZE=$_KB_SAN"
fi
