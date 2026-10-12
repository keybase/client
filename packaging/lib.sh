#!/usr/bin/env bash
# Shared helpers for the packaging scripts. Source it, don't run it.
# The variables here are read by the scripts that source this file.
# shellcheck disable=SC2034

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
