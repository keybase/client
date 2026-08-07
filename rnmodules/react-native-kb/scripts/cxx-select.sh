#!/usr/bin/env bash
# Sourced, not executed. Sets CXX to a C++ compiler and CXX_STD to the newest
# C++20 flag that compiler accepts.
#
# The Linux CI image's default g++ is old enough to reject -std=c++20 outright
# ("unrecognized command line option '-std=c++20'; did you mean '-std=c++2a'?"),
# even though it implements enough of C++20 under the pre-standardization
# -std=c++2a spelling to build these tests. Newer toolchains only know
# -std=c++20, so neither flag can be hardcoded -- probe instead.
#
# Usage:  source "$(dirname "${BASH_SOURCE[0]}")/cxx-select.sh"
#         "$CXX" "$CXX_STD" ...

# clang++ locally / on the mac builders, g++ on the Linux CI image. Versioned
# g++ binaries come first: an image can carry a modern g++-13 alongside a
# default g++ that predates C++20.
CXX="${CXX:-}"
if [ -z "$CXX" ]; then
  for _cxx_cand in clang++ g++-14 g++-13 g++-12 g++-11 g++-10 g++; do
    if command -v "$_cxx_cand" >/dev/null 2>&1; then
      CXX="$_cxx_cand"
      break
    fi
  done
fi
test -n "$CXX" || {
  echo "no C++ compiler found (looked for clang++ and g++)" >&2
  exit 1
}

CXX_STD=
for _cxx_std in -std=c++20 -std=c++2a; do
  if echo 'int main(){}' |
    "$CXX" "$_cxx_std" -x c++ - -o /dev/null >/dev/null 2>&1; then
    CXX_STD="$_cxx_std"
    break
  fi
done
test -n "$CXX_STD" || {
  echo "$CXX accepts neither -std=c++20 nor -std=c++2a" >&2
  exit 1
}
