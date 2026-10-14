This directory contains scripts that we use to build release packages
for the Keybase app. Most of this is only useful internally.

If you're packaging for Linux, more information is available in the
https://github.com/keybase/client/tree/master/packaging/linux directory.

## Entry points

The macOS, mobile and Windows builds are launched by the build bots in
[keybase/slackbot](https://github.com/keybase/slackbot) (`keybot/keybot.go`,
`keybot/winbot.go`). Check there before renaming a script or an environment
variable it reads.

| Script | Run by | Inputs |
|--------|--------|--------|
| `build_darwin.sh` → `prerelease/pull_build.sh` → `prerelease/build_app.sh` | keybot, macOS build machine | `ARCH` (`amd64`/`arm64`, both if unset), `CLIENT_COMMIT`, `TEST`, `SMOKE_TEST`, `NOWAIT` (skip the CI gate), `NOPULL`, `NOS3`, `NONOTARIZE`, `NOBUILD`, `CLEAN_CACHES`, `GOPATH` |
| `build_mobile.sh` | keybot, mobile build machine | runs the Android then the iOS script below |
| `android/build_and_publish.sh` | keybot (directly or via `build_mobile.sh`) | `CLIENT_COMMIT`, `CHECK_CI`, `AUTOMATED_BUILD`, `CACHE_NPM` (skip the JS install), `CACHE_GO_LIB`, `CLEAN_CACHES`, `ANDROID_*`/NDK paths |
| `ios/build_and_publish.sh` | keybot (directly or via `build_mobile.sh`) | `CLIENT_COMMIT`, `CHECK_CI`, `AUTOMATED_BUILD`, `CLEAN`, `CACHE_GO_LIB`, `CLEAN_CACHES` |
| `windows/dorelease.cmd` | winbot, Windows build machine | see the script header |
| `linux/docker_build.sh MODE COMMIT` | Linux build host | `KEYBASE_RELEASE` / `KEYBASE_NIGHTLY` / `KEYBASE_TEST`, `KEYBASE_TEST_CODE_SIGNING_KEY`, `BUCKET_NAME`, `SECRETS_TEAM`, `SECRETS_REPO` |

`CLEAN_CACHES=1` makes the build clear the yarn cache, `node_modules` and (macOS)
the Go build cache instead of reusing them. See `kb_clean_caches` below.

keybot also passes `KBFS_COMMIT` to `build_darwin.sh`; nothing reads it.

Chat notifications go through `slack/send.sh`, which posts to Keybase chat when
`KEYBASE_CHAT_CONVID` is set (`KEYBASE_LOCATION` and `KEYBASE_HOME` pick the
binary and home dir). Keep the `slack/` path: `prerelease/build_app.sh` checks
out the commit it builds while it is still running, so every path the running
copy calls must exist in any commit it can be asked to build.

## Shared code

`lib.sh` is sourced by the build scripts. It holds:

| Name | What |
|------|------|
| `KB_CLIENT_DIR` | root of the checkout `lib.sh` is in |
| `KB_CODESIGN_IDENTITY` | the Developer ID that signs macOS binaries and the app |
| `KB_INSTALLER_*`, `KB_UPDATER_*`, `kb_fetch_verified` | pinned KeybaseInstaller/KeybaseUpdater versions and checksums, and the verified download |
| `KB_CI_CONTEXTS` | the CI checks the release `wait-ci` gate waits for |
| `kb_lib_version` | the version in `go/libkb/version.go` |
| `kb_build_id` | a new `<UTC timestamp>+<short commit>` build id; compute once per build and pass it down as `KEYBASE_BUILD`/`KBFS_BUILD` |
| `kb_sign_binary <path>...` | signs binaries for `$PLATFORM` (macOS only) |
| `kb_release_bin` | builds the `release` tool once and exports its path as `KB_RELEASE_BIN`, which child scripts reuse |
| `kb_clean_caches` | true when `CLEAN_CACHES=1`; the three cache helpers below then always clear |
| `kb_prune_yarn_cache` | cleans the yarn cache only when its volume has less than `KB_MIN_FREE_GB` (default 30) free |
| `kb_yarn_modules <shared_dir>` | runs `yarn modules`, keeping `node_modules` unless `yarn.lock`, `package.json` or a patch changed since the last install |
| `kb_guard_go_cache` | on macOS, clears the Go build cache when the SDK, clang or `MACOSX_DEPLOYMENT_TARGET` changed |

The mobile release builds bundle their JS themselves (Gradle's release bundle
task, Xcode's "Bundle React Native Code And Images" phase in Release), so they
don't run a Metro server.

## Linting

The `Shellcheck` stage in the `Jenkinsfile` runs `shellcheck -S warning -x` over
every `.sh` file here plus `shared/react-native/gobuild.sh`, whenever one of them
(or the `Jenkinsfile`) changes. The Jenkins setup step installs a pinned,
checksummed shellcheck (v0.11.0). Run it from the repo root so the
`# shellcheck source=` directives resolve.
