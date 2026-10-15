#!/usr/bin/env bash
# Shared helpers for the packaging scripts. Source it, don't run it.
# The variables here are read by the scripts that source this file.
# shellcheck disable=SC2034

# Root of the client checkout this file lives in.
KB_CLIENT_DIR="$(CDPATH='' cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# "Developer ID Application: Keybase, Inc. (99229SGT5K)". Set
# KB_CODESIGN_IDENTITY=- to sign ad-hoc when testing locally.
KB_CODESIGN_IDENTITY="${KB_CODESIGN_IDENTITY:-90524F7BEAEACD94C7B473787F4949582F904104}"

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
      local args=(--verbose --force --options runtime --sign "$KB_CODESIGN_IDENTITY")
      # An ad-hoc signature (identity "-") can't be timestamped.
      if [ "$KB_CODESIGN_IDENTITY" != "-" ]; then
        args+=(--timestamp)
      fi
      local path
      for path in "$@"; do
        codesign "${args[@]}" "$path"
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

# kb_sign_app_inside_out <app> <entitlements>
# Signs the Electron code in <app> one item at a time, innermost first, then the
# app itself; Apple deprecates `codesign --deep` for signing. Code is found by
# looking for Mach-O files, so Electron upgrades that add or drop helpers and
# dylibs need no edits.
#   - Resources/KeybaseInstaller.app, Resources/KeybaseUpdater.app and
#     SharedSupport are left alone: their code arrives already signed (by
#     Keybase, or by kb_sign_binary) with its own entitlements. Any other
#     Mach-O, including under Resources (e.g. a native .node module), is signed.
#   - Executables and helper apps get <entitlements>, except executables inside
#     a framework's Resources (Squirrel's ShipIt), which only need the runtime.
#   - Dylibs, loadable bundles (.node) and frameworks get no entitlements.
kb_sign_app_inside_out() {
  local app="${1%/}" entitlements="$2"
  local base_args=(--verbose --force --options runtime --sign "$KB_CODESIGN_IDENTITY")
  # An ad-hoc signature (identity "-") can't be timestamped.
  if [ "$KB_CODESIGN_IDENTITY" != "-" ]; then
    base_args+=(--timestamp)
  fi

  # Collect nested code as "<depth>\t<kind>\t<path>": .app/.framework/.xpc
  # bundles, plus loose Mach-O files among the executables and libraries. A
  # bundle's own main binary is signed with its bundle, not on its own.
  local entries=() path kind
  while IFS= read -r -d '' path; do
    case "$path" in
      *.app/Contents/MacOS/*) continue ;;
    esac
    if [ -d "$path" ]; then
      kind=bundle
    elif [ -L "$path" ]; then
      continue
    else
      case "$(file -b "$path")" in
        *Mach-O*executable*) kind="exec" ;;
        *Mach-O*) kind="lib" ;;
        *) continue ;;
      esac
      # Versions/<v>/<binary> is the framework's main binary.
      case "$(dirname "$(dirname "$path")")" in
        *.framework/Versions) continue ;;
      esac
    fi
    entries+=("$(printf '%s' "$path" | tr -cd '/' | wc -c | tr -d ' ')	$kind	$path")
  done < <(find "$app/Contents" \
    \( -path "$app/Contents/MacOS" -o -path "$app/Contents/SharedSupport" \
       -o -path "$app/Contents/Resources/KeybaseInstaller.app" \
       -o -path "$app/Contents/Resources/KeybaseUpdater.app" \) -prune \
    -o -type d \( -name '*.app' -o -name '*.framework' -o -name '*.xpc' \) -print0 \
    -o -type f \( -perm -u+x -o -name '*.dylib' -o -name '*.so' -o -name '*.node' \) -print0)

  # Deepest paths first, so everything inside a bundle is signed before it.
  local args entry
  while IFS= read -r entry; do
    kind="$(printf '%s' "$entry" | cut -f2)"
    path="$(printf '%s' "$entry" | cut -f3-)"
    args=("${base_args[@]}")
    case "$path" in
      *.framework) ;;
      *.framework/Versions/*/Resources/*) ;;
      *.app|*.xpc) args+=(--entitlements "$entitlements") ;;
      *)
        if [ "$kind" = exec ]; then
          args+=(--entitlements "$entitlements")
        fi
        ;;
    esac
    codesign "${args[@]}" "$path"
  done < <(for entry in ${entries[@]+"${entries[@]}"}; do
    printf '%s\n' "$entry"
  done | sort -t "$(printf '\t')" -k1,1nr -k3,3)

  codesign "${base_args[@]}" --entitlements "$entitlements" "$app"
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

# CLEAN_CACHES=1 (set by the bot) makes kb_prune_yarn_cache, kb_yarn_modules and
# kb_guard_go_cache clear their caches unconditionally, for a from-scratch build.
kb_clean_caches() {
  [ "${CLEAN_CACHES:-}" = "1" ]
}

# kb_prune_yarn_cache
# Runs `yarn cache clean` only when the volume holding the yarn cache has less
# than KB_MIN_FREE_GB (default 30) free. The build machines are short on disk,
# but cleaning every build forces a full re-download. Never fails the build.
kb_prune_yarn_cache() {
  local min_gb="${KB_MIN_FREE_GB:-30}" cache_dir free_gb
  if kb_clean_caches; then
    echo "CLEAN_CACHES=1; cleaning the yarn cache"
    yarn cache clean || echo "yarn cache clean failed; continuing"
    return 0
  fi
  cache_dir="$(yarn cache dir 2>/dev/null)" || cache_dir=""
  if [ -z "$cache_dir" ]; then
    echo "Couldn't find the yarn cache dir; not pruning it"
    return 0
  fi
  mkdir -p "$cache_dir" 2>/dev/null || true
  free_gb="$(df -Pk "$cache_dir" 2>/dev/null | awk 'NR==2 {print int($4 / 1024 / 1024)}')" || free_gb=""
  if [ -z "$free_gb" ]; then
    echo "Couldn't read free disk space for $cache_dir; not pruning the yarn cache"
    return 0
  fi
  if [ "$free_gb" -lt "$min_gb" ]; then
    echo "${free_gb}GB free (< ${min_gb}GB); cleaning the yarn cache"
    yarn cache clean || echo "yarn cache clean failed; continuing"
  else
    echo "${free_gb}GB free (>= ${min_gb}GB); keeping the yarn cache"
  fi
  return 0
}

# kb_yarn_modules <shared_dir>
# Installs JS dependencies with `yarn modules`, keeping node_modules between
# builds. node_modules is deleted first only when yarn.lock, package.json, a
# patch-package patch (name or contents) or the node/yarn version changed since
# the last install there: yarn skips an unchanged lockfile, so an edited patch
# would otherwise meet the old one already applied. The stamp is removed while
# installing, so an install that fails or is killed is never reused.
kb_yarn_modules() {
  local shared_dir="$1" stamp_file stamp
  stamp_file="$shared_dir/node_modules/.kb-modules-stamp"
  stamp="$(cd "$shared_dir" && {
    node --version
    yarn --version
    cat yarn.lock package.json
    ls patches 2>/dev/null || true
    cat patches/* 2>/dev/null || true
  } | shasum -a 256 | cut -d' ' -f1)"
  if kb_clean_caches; then
    echo "CLEAN_CACHES=1; removing node_modules"
    rm -rf "$shared_dir/node_modules"
  elif [ -f "$stamp_file" ] && [ "$(cat "$stamp_file")" = "$stamp" ]; then
    echo "Dependencies unchanged; reusing node_modules"
  else
    echo "Dependencies or patches changed; removing node_modules"
    rm -rf "$shared_dir/node_modules"
  fi
  rm -f "$stamp_file"
  (cd "$shared_dir" && yarn modules) || return 1
  echo "$stamp" > "$stamp_file"
}

# kb_guard_go_cache
# The release builds reuse the Go build cache (no `go build -a`), but the cache
# doesn't key cgo objects on the macOS SDK headers and libraries. So on macOS,
# clear it whenever the SDK or clang changes. Never fails the build.
kb_guard_go_cache() {
  if kb_clean_caches; then
    echo "CLEAN_CACHES=1; clearing the Go build cache"
    go clean -cache || echo "go clean -cache failed; continuing"
    return 0
  fi
  if [ "$(uname)" != "Darwin" ]; then
    return 0
  fi
  local gocache fingerprint stamp_file
  gocache="$(go env GOCACHE 2>/dev/null)" || gocache=""
  fingerprint="$(xcrun --show-sdk-version 2>/dev/null && xcrun --show-sdk-build-version 2>/dev/null && clang --version 2>/dev/null | head -1 && echo "${MACOSX_DEPLOYMENT_TARGET:-}")" || fingerprint=""
  if [ -z "$gocache" ] || [ -z "$fingerprint" ]; then
    echo "Couldn't fingerprint the Go cache or toolchain; leaving the Go cache as is"
    return 0
  fi
  stamp_file="$gocache/.kb-toolchain"
  if [ -f "$stamp_file" ] && [ "$(cat "$stamp_file")" = "$fingerprint" ]; then
    echo "macOS SDK and clang unchanged; keeping the Go build cache"
    return 0
  fi
  echo "macOS SDK or clang changed; clearing the Go build cache"
  go clean -cache || { echo "go clean -cache failed; continuing"; return 0; }
  mkdir -p "$gocache" && echo "$fingerprint" > "$stamp_file" || true
  return 0
}
