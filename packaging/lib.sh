#!/usr/bin/env bash
# Shared helpers for the packaging scripts. Source it, don't run it.
# The variables here are read by the scripts that source this file.
# shellcheck disable=SC2034

# Root of the client checkout this file lives in.
KB_CLIENT_DIR="$(CDPATH='' cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# "Developer ID Application: Keybase, Inc. (99229SGT5K)"
KB_CODESIGN_IDENTITY="90524F7BEAEACD94C7B473787F4949582F904104"

# Native macOS apps bundled into Keybase.app. Bump the version and the sha256
# together: `shasum -a 256` of the tgz at the URL below.
KB_INSTALLER_VERSION=1.1.94
KB_INSTALLER_SHA256=5e405dfe95cf31af107c0dedbb9b94fcd0cdab1ce6c0d0f881d7847e262fc284
KB_INSTALLER_URL="https://prerelease.keybase.io/darwin-package/KeybaseInstaller-${KB_INSTALLER_VERSION}-darwin.tgz"
KB_UPDATER_VERSION=1.0.7
KB_UPDATER_SHA256=f90fa382058d92f3751d24a208422758731b26c997c4debb623f1fa08e46f729
KB_UPDATER_URL="https://prerelease.keybase.io/darwin-package/KeybaseUpdater-${KB_UPDATER_VERSION}-darwin.tgz"

# Checks the release tool's `wait-ci` gate requires to pass on a commit.
# packaging/windows/dorelease.cmd mirrors this list by hand.
KB_CI_CONTEXTS=("--context=continuous-integration/jenkins/branch")

# kb_fetch_verified <url> <sha256> <dest_dir>
# Downloads a .tgz, checks its sha256 and extracts it into dest_dir. Extracts
# nothing if the checksum doesn't match.
kb_fetch_verified() {
  local url="$1" sha="$2" dest="$3"
  local archive
  archive="$(mktemp "$dest/download.XXXXXX")"
  if ! curl --fail -sSL -o "$archive" "$url"; then
    rm -f "$archive"
    echo "Download failed: $url" >&2
    return 1
  fi
  if ! echo "$sha  $archive" | shasum -a 256 -c - >/dev/null; then
    rm -f "$archive"
    echo "Checksum mismatch for $url (expected $sha)" >&2
    return 1
  fi
  local rc=0
  tar zxf "$archive" -C "$dest" || rc=$?
  rm -f "$archive"
  return "$rc"
}

# kb_lib_version
# Prints the version in go/libkb/version.go, e.g. 6.7.0.
# packaging/windows/dorelease.cmd parses the same file on its own.
kb_lib_version() {
  local version
  version="$(grep 'Version = ' "$KB_CLIENT_DIR/go/libkb/version.go" | sed 's/.*Version = "\(.*\)"/\1/')"
  if [ -z "$version" ]; then
    echo "No Version in go/libkb/version.go" >&2
    return 1
  fi
  echo "$version"
}

# kb_build_id
# Prints a new build id, <UTC timestamp>+<short commit>. Each call stamps the
# current time, so compute it once per build and pass it down (KEYBASE_BUILD,
# KBFS_BUILD) so every binary and file name in that build agrees. Outside a git
# checkout (the Linux docker build) the commit comes from SOURCE_COMMIT.
kb_build_id() {
  local commit
  if [ -e "$KB_CLIENT_DIR/.git" ]; then
    commit="$(git -C "$KB_CLIENT_DIR" log -1 --pretty=format:%h)" || return 1
  else
    local source_commit="${SOURCE_COMMIT:-}"
    commit="${source_commit:0:10}"
  fi
  if [ -z "$commit" ]; then
    echo "No git commit and no SOURCE_COMMIT for the build id" >&2
    return 1
  fi
  echo "$(date -u +%Y%m%d%H%M%S)+$commit"
}

# kb_sign_binary <path>...
# Code signs the binaries for $PLATFORM. Only macOS binaries get signed here.
kb_sign_binary() {
  case "${PLATFORM:-}" in
    darwin|darwin-arm64)
      echo "Signing $*"
      local path
      for path in "$@"; do
        codesign --verbose --force --deep --timestamp --options runtime --sign "$KB_CODESIGN_IDENTITY" "$path"
      done
      ;;
    linux) echo "No codesigning for Linux" ;;
    windows) echo "No codesigning for Windows" ;;
    *)
      echo "Invalid PLATFORM: ${PLATFORM:-}" >&2
      return 1
      ;;
  esac
}

# kb_release_bin
# Builds the `release` tool into $GOPATH/bin and sets KB_RELEASE_BIN to it.
# KB_RELEASE_BIN is exported, so scripts this one runs reuse the binary instead
# of rebuilding it. The reuse is keyed on GOPATH and the checkout's commit, so a
# value inherited from another build or GOPATH is rebuilt. Call it directly, not
# inside $(...): a subshell would lose the export.
kb_release_bin() {
  local gopath="${GOPATH:-}"
  if [ -z "$gopath" ]; then
    gopath="$(go env GOPATH)"
  fi
  local key
  key="$gopath:$(git -C "$KB_CLIENT_DIR" rev-parse HEAD 2>/dev/null || echo "${SOURCE_COMMIT:-}")"
  if [ "${KB_RELEASE_BIN_KEY:-}" = "$key" ] && [ -x "${KB_RELEASE_BIN:-}" ]; then
    return 0
  fi
  echo "Loading release tool"
  (cd "$KB_CLIENT_DIR/go" && GOPATH="$gopath" GOBIN="$gopath/bin" go install "github.com/keybase/client/go/release")
  export KB_RELEASE_BIN="$gopath/bin/release"
  export KB_RELEASE_BIN_KEY="$key"
}
