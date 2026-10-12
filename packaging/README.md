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
| `build_darwin.sh` → `prerelease/pull_build.sh` → `prerelease/build_app.sh` | keybot, macOS build machine | `ARCH` (`amd64`/`arm64`, both if unset), `CLIENT_COMMIT`, `TEST`, `SMOKE_TEST`, `NOWAIT` (skip the CI gate), `NOPULL`, `NOS3`, `NONOTARIZE`, `NOBUILD`, `GOPATH` |
| `build_mobile.sh` | keybot, mobile build machine | runs the Android then the iOS script below |
| `android/build_and_publish.sh` | keybot (directly or via `build_mobile.sh`) | `CLIENT_COMMIT`, `CHECK_CI`, `AUTOMATED_BUILD`, `CACHE_NPM`, `CACHE_GO_LIB`, `ANDROID_*`/NDK paths |
| `ios/build_and_publish.sh` | keybot (directly or via `build_mobile.sh`) | `CLIENT_COMMIT`, `CHECK_CI`, `AUTOMATED_BUILD`, `CLEAN`, `CACHE_GO_LIB`, `GOPATH` |
| `windows/dorelease.cmd` | winbot, Windows build machine | see the script header |
| `linux/docker_build.sh MODE COMMIT` | Linux build host | `KEYBASE_RELEASE` / `KEYBASE_NIGHTLY` / `KEYBASE_TEST`, `KEYBASE_TEST_CODE_SIGNING_KEY`, `BUCKET_NAME`, `SECRETS_TEAM`, `SECRETS_REPO` |

keybot also passes `KBFS_COMMIT` to `build_darwin.sh`; nothing reads it.

Chat notifications go through `slack/send.sh`, which posts to Keybase chat when
`KEYBASE_CHAT_CONVID` is set (`KEYBASE_LOCATION` and `KEYBASE_HOME` pick the
binary and home dir).

## Shared code

`lib.sh` is sourced by the build scripts. It holds the pinned
KeybaseInstaller/KeybaseUpdater versions and checksums, `kb_fetch_verified`,
and the CI checks the release `wait-ci` gate waits for.

## Linting

The `Shellcheck packaging scripts` GitHub workflow
(`.github/workflows/shellcheck.yml`) runs `shellcheck -S warning -x` over every
`.sh` file here plus `shared/react-native/gobuild.sh` and
`shared/react-native/packageAndBuild.sh`. Run it from the repo root so the
`# shellcheck source=` directives resolve.
