# 02 — Install, status, CLI, migration

Status: [ ] not started

## Goal

Make the Go install layer treat stock macFUSE 5.x (kext mode) as the only macOS driver (D5, D7), with no root helper and no `/keybase` redirector (D25), and no `app` install component on macOS (D38). The status RPC and the CLI report macFUSE (D10, D14, D32). Install never ships or installs a FUSE driver (D9). The user's Finder choice persists in a marker file (D27). `install-auto` retires the legacy helper and kbfuse once, retrying on the next launch if that fails (D29, D33). The CLI symlink moves to a one-time `osascript` admin prompt (D28), and the updater's rename fallback uses the same prompt helper instead of the deleted `app` component (D45). Windows and Linux are untouched (D4).

## Depends on

- `decisions.md`: D4–D6, D9, D10, D14, D17, D18, D25–D29, D31–D33, D38–D41, D45, D46.
- `00-macfuse-facts.md`: bundle path `/Library/Filesystems/macfuse.fs`, kext ID `io.macfuse.filesystems.macfuse`, version key `CFBundleShortVersionString`/`CFBundleVersion`, fstype `macfuse` (**SPIKE** for the live string), `load_macfuse` path.
- `01-mounter.md`: `mounter.IsMounted` accepts `macfuse` and `kbfuse` (D26), the D30 mount point, and `WaitForMounts` no longer waiting for redirector paths.
- `03-osx-packaging.md`: the new `KeybaseInstaller --retire-helper` switch that runs the D29 steps (extended by D40, and by D41 as widened by D46), and the removal of every installer switch that would install the helper, including `--install-app-bundle`/`--uninstall-app` (D38).
- `04-ui.md` reads `FuseStatus` per change 2 and keeps the `installFuse` → exit code 5 path (D31). Its Settings "Install command line tool" button (D39) execs `keybase install --components=clipaths` from Electron's main process, so no RPC is added here.

## Current state (verified 2026-10-06 on `nojima/macfuse-upstream` @ 6b06505404)

- `go/install/fuse_status_darwin.go`
  - `:22` `installPath = "/Library/Filesystems/kbfuse.fs"`; `:36` kext ID `com.github.kbfuse.filesystems.kbfuse`.
  - `:38` calls `kext.LoadInfo` (`github.com/keybase/go-kext`, `go/go.mod:48`), nil when not loaded; `:50-62` falls back to `CFBundleVersion` in the bundle plist.
  - `:77` runs `mountInfo("kbfuse")` (`/sbin/mount -t kbfuse`, `:95`). `mountInfo` (`:94-117`) splits each line on spaces, so a mount point with a space (`/Volumes/Keybase (user)`) is cut at the space. **Bug:** `:107-108` guards `len(info) >= 2` and then reads `info[2]`.
  - `:86` calls `ResolveInstallStatus` (`install.go:129-174`).
- `go/install/fuse_status_default.go:10` and `fuse_status_windows.go:90` are the other platforms. Windows puts extra data in `Status.Fields` (`fuse_status_windows.go:120`). `install_windows.go:30-43` `Install`/`Uninstall` are empty stubs.
- `go/install/install_darwin.go`
  - `:51-56` exit codes 6 (auth canceled), 8 (critical update), 300; `:441` `mountsPresentErrorCode = 7`.
  - `:410-439` `InstallAuto`: kbfuse `INSTALLED` ⇒ cli, updater, service, kbfs, helper, fuse, mountdir, redirector, kbfs again; otherwise cli, updater, service, kbfs.
  - `:443-481` `installFuse` (redirector stop/retry around `--install-fuse`).
  - `:484-648` `Install`: cli (`:491-497`, unprivileged symlink), app (`:499-505`, `libnativeinstaller.InstallAppBundle`), updater, service, helper with auth-cancel/critical-update cleanup (`:523-602`), fuse (`:604-611`), mountdir (`:613-620`), kbfs, redirector (`:629-635`), clipaths (`:639-645`, `--install-cli` through the helper's `addToPath`).
  - `:650-724` `installCommandLine`: symlinks `/usr/local/bin/keybase` and `git-remote-keybase` (`install.go:195-205` `defaultLinkPath`) without privileges.
  - `:757-802` `InstallKBFS`: passes `-mount-type=none` when the mount dir does not exist (`:771-779`, `kbfsPlist` `:325-327`).
  - `:822-914` `Uninstall`: redirector, kbfs, service, updater, mountdir, fuse, app (`:881-887`, `libnativeinstaller.UninstallApp`), clipaths, helper, cli.
  - `:916-935` `UninstallKBFSOnStop` (used by `keybase ctl stop`, `go/client/cmd_ctl_stop_osx.go:88`, and `stop_darwin.go:28`) calls `--uninstall-mountdir`.
  - `:937-962` `unmount` uses `mounter.IsMounted`.
- `go/install/libnativeinstaller/app.go:68-149`: `execNativeInstallerWithArg` plus wrappers for `--install/uninstall-mountdir`, `-redirector`, `-fuse`, `-helper`, `-cli`, `--install-app-bundle` (`InstallAppBundle`, `:140-144`), `--uninstall-app` (`UninstallApp`, `:146-150`).
- `go/updater/keybase/platform_darwin.go:207-211`: before an update the updater runs `keybase uninstall --components=redirector`.
- `go/updater/keybase/platform_darwin.go:334-353` (`Apply`): when renaming `/Applications/Keybase.app` fails with an `*os.LinkError`, the updater falls back to `keybase install --components=app --source-path=<unzipped app>` (`:346`). Correction to the earlier draft, which said that path moves the bundle as root: `KeybaseInstaller` runs as the user (`libnativeinstaller/app.go:68-79` execs it with no privilege). The `app` component blesses the helper first (`KBEnvironment.m:52-55`, an admin prompt only when the helper is missing or outdated). `KBAppBundle install` (`KBAppBundle.m:80-113`) then checks the source bundle's code signature against a Keybase requirement (`validate:`, `:35-78`, requirement text `:63`). It replaces `Keybase.app/Contents` in place, in the installer process (`_moveFromSource:`, `:24-33`, called at `:103`), and re-checks the signature of the result (`:109-111`). So it only worked when the user could write inside the bundle but not rename it in `/Applications`. This is the only automatic caller of the `app` component; `sourcePath` exists only for it (`cmd_install_osx.go:52-55` `install --source-path`, `:308-311` `install-auto --source-path`, threaded through `Install`/`InstallAuto` and the `install_default.go:17`/`install_windows.go:30` stubs).
- The updater runs as the logged-in user: a launchd agent whose plist goes to `~/Library/LaunchAgents` (`go/launchd/launchd.go:551-553`, plist built by `updaterPlist`, `install_darwin.go:1218-1228`). It checks hourly (`DefaultTickDuration`, `go/updater/update_checker.go:8`). It verifies the downloaded asset's saltpack signature before `Apply` (`go/updater/updater.go:172-174`, `go/updater/keybase/context.go:137-139`). In auto mode it applies only when the GUI reports the user idle for 5 minutes (`updater.go:165-170`, `:447-449`).
- No Go code runs `osascript` today (`git grep -n osascript -- go/install go/updater` is empty).
- `install.ComponentNameApp` (`install.go:55`) also names the GUI app for `keybase ctl start/stop` (`cmd_ctl.go:36`, `cmd_ctl_start_osx.go:105`, `cmd_ctl_stop_osx.go:77`); that meaning is unrelated to installing and stays.
- `go/service/install.go`: `FuseStatus` (`:28-31`), `InstallFuse` = `{helper, fuse}` (`:33-38`), `InstallKBFS` = `{mountdir, kbfs, redirector}` (`:40-45`), `UninstallKBFS` = `{redirector, kbfs, mountdir, fuse}` (`:47-56`), `InstallCommandLinePrivileged` = `{clipaths}` (`:58-62`). The last RPC is not in `protocol/bin/enabled-calls.json`, so the UI cannot call it.
- The legacy helper (to be retired, D29): binary `/Library/PrivilegedHelperTools/keybase.Helper` (`osx/KBKit/KBKit/Component/KBHelperTool.m:20`), launchd plist `/Library/LaunchDaemons/keybase.Helper.plist` (label and Mach service `keybase.Helper`, `osx/Helper/keybase.Helper.plist`; installed copy also has `Program` = the binary path). Version 1.0.47 (`osx/Helper/Info.plist:12-16`). It is reachable only over XPC from KBKit, so Go drives it through `KeybaseInstaller`.
- The UI enables Finder with `installFuse` → `installKBFS` → `waitForMounts` (`shared/util/fs-platform.tsx:132-160`). Electron runs `keybase install-auto --format=json` at launch and, if the `cli` component failed, once runs `keybase install --components=clipaths` (`shared/desktop/app/installer.desktop.tsx:187-215`, remembered in `<userData>/installer.json`). A failed `fuse` result adds no dialog text (`:71-80`).
- CLI
  - `go/client/cmd_fuse_osx.go:26-73`: `keybase fuse status [-b bundle-version]` prints `FuseStatus` JSON. `KBFuseComponent.m:51-53` calls it with `--bundle-version`.
  - `go/client/cmd_install_osx.go:87-96` `defaultInstallComponents`: updater, service, cli, helper, fuse, mountdir, kbfs, redirector. `:166-175` `defaultUninstallComponents`: service, kbfs, redirector, mountdir, updater, fuse, helper, cli. `:139-164` `Run`/`exitOnError`.
  - `go/client/cmd_kbfs_mount.go` is `//go:build windows` (`:4`): out of scope.
- `protocol/avdl/keybase1/install.avdl`: `InstallStatus` (`:11-16`), `InstallAction` (`:19-25`), `FuseMountInfo {path, fstype, output}` (`:44-48`), `FuseStatus` (`:50-60`).
- Tests: `fuse_status_darwin_test.go` (only `findStringInPlist`), `install_darwin_test.go`, `install_test.go`, `install_windows_test.go`.

## Changes

1. **No avdl change.** The existing enums express every state (change 2). Extra data goes in `Status.Fields`, as on Windows. Nothing is regenerated.
2. **`fuse_status_darwin.go` rewrite** (D10, D26). Split it into an I/O probe and a pure derivation:
   - Constants: `macfusePath`, `macfuseKextID`, `minMacfuseMajor = 5`; `kbfsFstypes = {"macfuse", "kbfuse"}` with a comment tying `kbfuse` to the D29 window; `legacyKbfusePath = "/Library/Filesystems/kbfuse.fs"`.
   - `type macfuseProbe struct { BundleExists bool; PlistErr error; PlistVersion string; KextInfo *kext.Info; KextInfoErr error; LegacyKbfuse bool }`.
   - `func deriveFuseStatus(p macfuseProbe) keybase1.FuseStatus` is pure; **the first matching row wins**:

     | condition | InstallStatus / InstallAction | other fields |
     |---|---|---|
     | `!BundleExists` | `NOT_INSTALLED` / `INSTALL` | `Status.Desc` = `msgNotInstalled` |
     | `PlistErr != nil`, or the version does not parse (`semver.ParseTolerant`) | `ERROR` / `REINSTALL` | `Status` code `SCGeneric`, name `INSTALL_ERROR` |
     | major < 5 | `INSTALLED` / `UPGRADE` | `Version`, `Status.Desc` = `msgOutdated` |
     | `KextInfoErr != nil` | `ERROR` / `NONE` | error text |
     | otherwise (ready) | `INSTALLED` / `NONE` | `Version`, `KextID`, `KextStarted = KextInfo != nil && KextInfo.Started` |

   - Every row sets `Path` when the bundle exists. If `LegacyKbfuse`, every row appends `Status.Fields {Key: "legacyKbfuse", Value: legacyKbfusePath}`.
   - "Kext not approved" is not a static status: the kext loads lazily, and approval cannot be read without root. It comes from change 4's exit code 5 (D31).
   - `MountInfos` lists mounts whose fstype is in `kbfsFstypes` (D26), parsed by a pure `parseMountOutput(fstype, out string)` that splits each line on `" on "` and the last `" ("`, so mount points with spaces survive (fixes the `:107` bug).
   - Other apps also mount with fstype `macfuse`, so the service `FuseStatus` handler (`go/service/install.go:28-31`) narrows `MountInfos` to the user's KBFS mount: a new `install.FilterKBFSMountInfos(st *keybase1.FuseStatus, mountDir string)` (darwin: keep infos whose `Path` equals `mountDir`; `fuse_status_default.go`/`fuse_status_windows.go`: no-op) is called with `G().Env.GetMountDir()`. 04 reads "KBFS is mounted" as `mountInfos` non-empty. `keybase fuse status` (`cmd_fuse_osx.go:65` calls `KeybaseFuseStatus` directly) applies the same filter.
   - `KeybaseFuseStatus(bundleVersion, log)` keeps its signature; darwin ignores `bundleVersion` and no longer calls `ResolveInstallStatus` (the function stays for other callers).
   - Message constants in `go/install/install.go`, shared by the CLI and the RPC:
     - `msgNotInstalled = "macFUSE is not installed. To use Keybase in Finder, install macFUSE 5 or later from https://macfuse.io"`
     - `msgOutdated = "macFUSE %s is installed, but Keybase needs macFUSE 5 or later. Update it from https://macfuse.io"`
     - `msgKextNotLoadable = "macFUSE is installed, but macOS has not allowed its system extension yet."`
3. **go-kext stays** (`go.mod:48`), used only for `kext.LoadInfo(macfuseKextID)`.
4. **The `fuse` component now means "require stock macFUSE" (D31, D32).** Delete `installFuse` and `mountsPresentErrorCode` (`:441-481`). Add `ensureMacfuse(log) keybase1.ComponentResult`:
   - Not ready (`NOT_INSTALLED`, `UPGRADE` or `ERROR` rows): status `SCInstallError` with the row's message, logged with `log.Errorf` so the CLI shows it.
   - Ready and `KextStarted`: OK.
   - Ready and not started: run `<macfusePath>/Contents/Resources/load_macfuse` (a load, not an install, so D9 allows it), then re-probe. Still not started ⇒ `ExitCode: 5` (`exitCodeKextNotLoadable`; `shared/constants/values.tsx:6` already uses 5) with `msgKextNotLoadable`. `componentResult` (`:1131`) cannot carry a custom exit code, so build this result by hand.
   - Whether `load_macfuse` can run as the user, and what it returns when not approved, is **SPIKE** (01). If it needs root, the fallback is: skip the load, return OK, and let the mount attempt fail; 04 then shows the approval help when `waitForMounts` returns false while `KextStarted` is false. Record which branch the spike picked in the Log.
5. **Legacy retirement (D29, D33).** New `retireLegacyHelper(context, log) keybase1.ComponentResult` in `install_darwin.go`:
   - Runs only when `/Library/PrivilegedHelperTools/keybase.Helper` exists. If it is absent, return OK; a leftover `kbfuse.fs` without a helper is logged and left alone, since nothing can remove it without an admin prompt (see Risks).
   - Steps:
     1. If the user's KBFS is mounted on kbfuse (`mounter.IsMounted`, D26), `UninstallKBFS(context, mountDir, true, log)` so the kext can unload, and so this user's `/Volumes/Keybase (<user>)` is no longer a mount point (D41, D46).
     2. `libnativeinstaller.RetireLegacyHelper(runMode, log)` → `KeybaseInstaller --retire-helper` (03 change 6). It calls only helper 1.0.47 methods, in this order: `stopRedirector` for `/keybase` and for the `/Volumes/Keybase` fallback (D40) → `kextUnload` + `kextUninstall` (kbfuse) → `remove` `/keybase` and `/Volumes/Keybase` (D40) → under the `~/Keybase` outcome only, `remove` every `/Volumes/Keybase (*)` directory that is not a mount point, for every account on the Mac, not just the one running the migration (D41 as widened by D46; 03 change 6 step 4 has the enumeration, the per-directory mount-table guard, and why the step stays conditional) → `remove` the helper's plist and binary. The installer computes every path itself, so Go passes no new arguments. Step 1 unmounts only this user's KBFS. Another account's live kbfuse mount makes the `kextUnload` fail, or failing that the mount guard, so the run exits 1 and retries next launch (D33).
   - Result name `fuse`, so the Electron startup check shows no dialog (`installer.desktop.tsx:71-80`). On failure log "legacy helper retirement failed; will retry next launch" and return the error. Any non-zero installer exit means retry (D33): until the 1.1.95 installer ships, `--retire-helper` is an unknown switch and exits 1.
   - The retry is implicit: every `install-auto` re-checks the helper binary. After exit 0, re-check that the binary is gone and treat its presence as a failure (guards against an installer that ignores the unknown switch, 03 Risks).
6. **`InstallAuto` (`:410-439`).**
   - Extract a pure `installAutoComponents() []string`: cli, updater, service, kbfs, deduped (today `:418` and `:423` list kbfs twice). No helper, fuse, mountdir or redirector (D25).
   - Before `Install`: if `legacyKbfusePath` exists, set the D27 marker (the user had Finder access). Then, if the legacy helper exists, run `retireLegacyHelper` **before** the kbfs component, so kbfs restarts on macFUSE. To get that order, `Install` gains an internal `retireLegacy bool` parameter, or a `componentNameLegacyHelper` that is not in `ComponentNames`.
7. **D27 marker.** `filepath.Join(context.GetConfigDir(), "kbfs_finder_enabled")` (`Context.GetConfigDir`, `install.go:32`). Helpers `mountOptIn(ctx) bool` and `setMountOptIn(ctx, bool) error`.
8. **`InstallKBFS` mount decision (D6, D27, D30).** Replace the "mount dir exists" check (`:771-779`) with a pure `shouldMountKBFS(optIn bool, st keybase1.FuseStatus) bool` = marker set **and** macFUSE ready. Otherwise pass `-mount-type=none`. The mount dir itself is created by `mount_macfuse` or by kbfs (01 change 8), not here.
9. **`go/service/install.go`** (cross-platform file; Windows `Install`/`Uninstall` are stubs, so it is unaffected).
   - `InstallFuse` = `{fuse}` (D25 drops `helper`; D31 keeps the RPC).
   - `InstallKBFS` = set the marker, then `{kbfs}` (plus `mountdir` only under the `~/Keybase` fallback, for 03's Finder sidebar entry).
   - `UninstallKBFS` = clear the marker, `Uninstall {kbfs}` (unmounts), then `Install {kbfs}` so KBFS keeps running unmounted. Chat and the in-app Files tab need it (D6), and 04 no longer relaunches the app. Plus `mountdir` uninstall under the fallback. Drop `redirector` and `fuse`; rewrite the comment at `:48-52`.
   - `InstallCommandLinePrivileged` stays `{clipaths}` (change 11).
10. **Remove the helper and redirector from darwin flows (D25).**
    - `Install`: delete the `helper` block with its critical-update cleanup (`:523-602`), the `redirector` block (`:629-635`) and their exit codes 6, 8 and 300 (`:51-56`; D38 removes the last component that could produce 6 or 8). Delete `mountdir` (`:613-620`) unless the spike picked the fallback. `helper`/`redirector` passed explicitly become no-ops.
    - `Install` and `Uninstall`: delete the `app` blocks (`:499-505`, `:881-887`, D38). An explicit `--components=app` returns a failed `app` result, "the app component is not supported on macOS", rather than a silent OK, so a stale caller cannot mistake it for a completed bundle move.
    - Drop `sourcePath` (D38; only `app` read it): the `--source-path` flags (`cmd_install_osx.go:52-55`, `:308-311`), the `CmdInstall`/`CmdInstallAuto` fields, and the `sourcePath` parameter of `Install` (`install_darwin.go:484`, `install_default.go:17`, `install_windows.go:30`) and `InstallAuto` (`install_darwin.go:410`) with their callers (`cmd_install_osx.go:133,359`, `cmd_kbfs_mount.go:76`, `go/service/install.go:35,42,60`).
    - `Uninstall`: `redirector` becomes a no-op; `helper` and `fuse` both run `retireLegacyHelper` (D14, D29; it is idempotent). `mountdir` only under the fallback.
    - `UninstallKBFSOnStop` (`:916-935`): drop `UninstallMountDir` unless the fallback needs the sidebar entry removed.
    - `libnativeinstaller/app.go`: delete the `InstallFuse`, `UninstallFuse`, `InstallRedirector`, `UninstallRedirector`, `InstallHelper`, `UninstallHelper`, `InstallCommandLinePrivileged`, `UninstallCommandLinePrivileged`, `InstallAppBundle` and `UninstallApp` (`:140-150`, D38) wrappers; add `RetireLegacyHelper` (`--retire-helper`). Keep the mountdir wrappers only under the fallback.
    - `go/updater/keybase/platform_darwin.go:207-211`: delete the `uninstall --components=redirector` call.
    - `go/updater/keybase/platform_darwin.go:334-353`: replace the `install --components=app` fallback (D38) with a one-time admin prompt that does the rename (D45). The updater runs as the user (Current state), so it shows the prompt itself through the change 11 helper. It does not exec `keybase`. In the `*os.LinkError` branch (`:334-335`, condition unchanged):
      1. Unzip as today (`:338-344`) to get `sourcePath`.
      2. Check `sourcePath` with `/usr/bin/codesign --verify --deep --strict --test-requirement=<"=" + requirement> <sourcePath>`, as the user and before any prompt, where `<requirement>` is the `KBAppBundle.m:63` text copied into a Go constant. This keeps the signature check the old path ran (`KBAppBundle.m:35-78`), so root never moves an unsigned bundle. The exact `--test-requirement` syntax is **UNVERIFIED**; check it with How to verify 5. A failed check returns the error with no prompt.
      3. `cmd := appSwapCommand(sourcePath, destinationPath)`, a pure function in `platform_darwin.go`. With `S` = `sourcePath`, `D` = `destinationPath` and `B` = `<dir of D>/.<base of D>.updating`, all three quoted with `adminprompt.ShellQuote`: `/bin/rm -rf B && /bin/mv D B && { /bin/mv S D || { /bin/mv B D; exit 1; }; } && /bin/rm -rf B`. If moving the new bundle in fails, the old one is restored. The whole bundle moves, not just `Contents` as `KBAppBundle` did, because root can rename in `/Applications`.
      4. `adminprompt.Run(ctx, "Keybase needs your permission to finish installing an update.", cmd)` with a 5-minute `context.WithTimeout`, long enough to type a password. One prompt per apply that needs it; nothing is persisted.
      5. Re-run the step 2 `codesign` check on `destinationPath`, as `KBAppBundle.m:109-111` did. If that fails, return the error.
      - On `adminprompt.ErrCanceled` or a timeout, log "update needs administrator approval; canceled" and return the error. The updater treats it as any failed apply and tries again on a later check (hourly, Current state), so a canceled prompt can come back (Risks).
      - The rest of `Apply` (spotlight, `:358` onward) is unchanged. The log line at `:336` changes to name the admin prompt.
11. **CLI on PATH (D28) and the shared admin prompt (D45).** Reimplement `clipaths` in Go, with no helper, on top of one `osascript` helper that the updater (change 10) also uses:
    - **Shared helper: new package `go/install/adminprompt`.** It imports only the standard library, so the updater can import it without depending on `go/install` and everything that package pulls in. The updater does not import `go/install` today.
      - `adminprompt.go` (no build tag, so the pure parts are tested on every CI platform):
        - `func ShellQuote(s string) string`: POSIX single-quote quoting (`'` → `'\''`).
        - `func appleScriptString(s string) string`: wraps a string in an AppleScript `"…"` literal, escaping `\` and `"`.
        - `func script(prompt, shellCmd string) string`: returns `do shell script <shellCmd> with prompt <prompt> with administrator privileges`, both as `appleScriptString`.
        - `func isCanceled(output string) bool`: true when the `osascript` output has error `(-128)`.
        - `var ErrCanceled = errors.New("administrator prompt canceled")`.
      - `adminprompt_darwin.go` (`//go:build darwin`): `func Run(ctx context.Context, prompt string, shellCmd string) (output string, err error)`. It runs `exec.CommandContext(ctx, "/usr/bin/osascript", "-e", script(prompt, shellCmd))` with `CombinedOutput`. A non-zero exit with `isCanceled(out)` returns `ErrCanceled`; other failures return an error that wraps the output. It takes no logger, so it suits both the install `Log` and the updater's `Log`; callers log the result.
      - Callers: `install_darwin.go` (`clipaths`, below) and `go/updater/keybase/platform_darwin.go` (change 10). Both are darwin-only, so no other platform needs a stub.
    - New `installCommandLinePrivileged(binPath, log)` calls `adminprompt.Run` with the prompt "Keybase wants to install the keybase command line tool." and `<cmd>` = `mkdir -p /usr/local/bin && ln -sfn <keybase bin> /usr/local/bin/keybase && ln -sfn <git-remote-keybase bin> /usr/local/bin/git-remote-keybase`. Paths are quoted with `adminprompt.ShellQuote`, and the bin paths come from `chooseBinPath` (`install.go:222`), as `installCommandLine` already does.
    - `uninstallCommandLinePrivileged` removes the two links only if they point into the app bundle, plus `/etc/paths.d/Keybase` if present (left by the old helper's fallback, `osx/Helper/KBHelper.m:450-473`), all in one prompt.
    - A user cancel (`osascript` error -128) returns a failed `clipaths` result with the cancel text. Electron does not retry it, because it records the attempt in `installer.json`.
    - Triggers, both from Electron's main process, both the same `install --components=clipaths --format=json` exec:
      - First run, unchanged: Electron runs it once when the unprivileged `cli` component fails (`installer.desktop.tsx:187-204`). Upgraders whose `cli` component succeeds keep their symlink and never see a prompt.
      - Settings "Install command line tool" button (D39, 04 change 16), any number of times.
    - No RPC is needed: the service-side `InstallCommandLinePrivileged` (`go/service/install.go:58-62`) stays as is and stays out of `enabled-calls.json`. An `osascript` admin prompt started by the launchd-run service is less likely to reach the user's session than one started by Electron (**UNVERIFIED**, Risks).
    - `keybase uninstall` (`defaultUninstallComponents`) adds `clipaths`, so it removes the symlink "the same way" (D28).
12. **CLI (D14, D32).**
    - `cmd_install_osx.go:87-96`: `defaultInstallComponents` becomes updater, service, cli, kbfs. Plain `keybase install` stays green without macFUSE.
    - `cmd_install_osx.go:166-175`: `defaultUninstallComponents` becomes service, kbfs, updater, fuse (legacy retirement), clipaths, cli.
    - In `CmdInstall.Run` (`:139-150`), when not using JSON, print each failed component's `Status.Desc` to stderr before `exitOnError`. `keybase install --components=fuse` then exits 0 when macFUSE is ready, prints `msgNotInstalled`/`msgOutdated` and exits 2 when missing or outdated, and exits 5 when the kext cannot load (D32).
    - `cmd_fuse_osx.go:35`: usage "Status of the macFUSE install (https://macfuse.io)". Delete `-b/--bundle-version` (`:29-34`, `:46`, `:60`) in the same commit where 03 deletes the `KBFuseComponent` status call (`KBFuseComponent.m:51-53`).
13. Update this spec's Log and `README.md` in the same commit (D23).

## Acceptance criteria

- `git grep -n -i -E 'kbfuse|redirector|install-helper|InstallHelper' go/install go/service go/client/cmd_install_osx.go go/client/cmd_fuse_osx.go go/updater/keybase/platform_darwin.go` matches only: the D26 `kbfuse` fstype, `legacyKbfusePath` and `retireLegacyHelper` with D29 comments, and the cross-platform `ComponentNameRedirector` in `install.go`.
- `git grep -n -E 'InstallAppBundle|UninstallApp\b|install-app-bundle|uninstall-app|components=app' -- go` and `git grep -n -E 'source-path|sourcePath' -- go/install go/client/cmd_install_osx.go` are empty (D38). The updater's own `check(sourcePath, …)` (`platform_darwin.go:306`) and its rename-fallback `sourcePath` local are unrelated and stay.
- `git grep -n osascript -- go` matches only `go/install/adminprompt/` (D28, D45). `git grep -n adminprompt -- go` shows exactly two callers: `go/install/install_darwin.go` and `go/updater/keybase/platform_darwin.go`.
- The updater's rename fallback runs `codesign` before the prompt and on the result, shows at most one admin prompt per apply, restores the old bundle if moving the new one fails, and never execs `keybase install` (D45).
- `deriveFuseStatus`, `parseMountOutput`, `FilterKBFSMountInfos`, `installAutoComponents`, `shouldMountKBFS`, `adminprompt.ShellQuote`, `appleScriptString`, `script`, `isCanceled` and the updater's `appSwapCommand` are pure and table-tested.
- `keybase install` (default components) exits 0 with no macFUSE. `keybase install --components=fuse` exits 0 when ready and non-zero with a https://macfuse.io message when missing or outdated (D32).
- With macFUSE ready and no marker, `install-auto` starts kbfs with `-mount-type=none`. With the marker set, kbfs mounts at the D30 mount point.
- On a machine with the legacy helper: one `install-auto` run with the 1.1.95 installer removes `/Library/Filesystems/kbfuse.fs`, `/keybase`, `/Volumes/Keybase` if present (D40), under the `~/Keybase` outcome every `/Volumes/Keybase (*)` directory that is not a mount point, other accounts' included (D41, D46), `/Library/LaunchDaemons/keybase.Helper.plist` and `/Library/PrivilegedHelperTools/keybase.Helper`, and shows no admin prompt. With 1.1.94, the run returns a failing `fuse` result and the next launch retries (D33).
- No code path runs `SMJobBless`: Go never execs `--install-helper`, `--install-redirector`, `--install-cli` or `--install-app-bundle` (all deleted, 03, D38), and `--install-mountdir` (fallback only) no longer requires the helper (03 change 4).
- `go.mod` keeps go-kext; `go mod tidy` produces no diff.

## How to verify

From `go/` in the worktree:

```sh
go test ./install/... ./service/ -run 'Fuse|InstallAuto|Mount|Legacy|CommandLine' -count=1
go test ./install/adminprompt/ ./updater/keybase/ -count=1
go vet ./install/... ./client/... ./service/... ./updater/...
GOOS=windows go build ./install/... ./client/... ./service/... ./updater/... && GOOS=linux go build ./install/... ./client/... ./service/... ./updater/...
gofmt -l install client service updater && golangci-lint run --new-from-rev master ./install/... ./client/... ./service/... ./updater/...
go build -tags production -o /tmp/macfuse-spike/keybase ./keybase
```

New tests in `go/install/fuse_status_darwin_test.go`: every row of the change 2 table plus the legacy field; versions `4.8.0`, `5.0`, `5.0.6`, `garbage`, empty; `parseMountOutput` with a mount point containing spaces and with malformed lines.

New tests in `go/install/install_darwin_test.go`: `installAutoComponents` (no duplicate `kbfs`, no helper/redirector); `shouldMountKBFS` for each marker × status row; marker round-trip in a `t.TempDir()` config dir.

New tests in `go/install/adminprompt/adminprompt_test.go` (all platforms): `ShellQuote` with spaces, `'`, `"`, `$` and parentheses (`/Volumes/Keybase (user)`); `appleScriptString` with `\` and `"`; `script` output for a command holding all of these; `isCanceled` on real `osascript` cancel output (`execution error: User canceled. (-128)`) and on another error.

New test in `go/updater/keybase/platform_darwin_test.go`: `appSwapCommand` for `/Applications/Keybase.app` and for a source path with spaces. Check the backup path, the restore branch, and that every path is quoted.

Manual checks with the D19 dev service and `/tmp/macfuse-spike/keybase`:
1. `keybase fuse status` before and after the first mount (`kextStarted`, `mountInfos`).
2. `keybase install --components=fuse; echo $?` and `keybase install; echo $?`.
3. Legacy retirement on the dev box (it has the 1.0.47 helper installed): `keybase install-auto --format=json` with the installed 1.1.94 installer must fail softly; with a locally built installer it cannot reach the helper (signature check, 03). The end-to-end run needs the signed 1.1.95 build (D33).
4. `keybase install --components=clipaths` shows one admin prompt and creates the links; `keybase uninstall --components=clipaths` removes them with one prompt. Cancel the prompt once and check the error result.
5. Updater fallback (D45), without touching the real `/Applications/Keybase.app`: in `/tmp/adminprompt-test/`, make a root-owned directory (`sudo mkdir`, `sudo chown root:wheel`) holding a copy of a signed `Keybase.app`. Run `appSwapCommand` plus `adminprompt.Run` from a throwaway `main` in `/tmp/` against an unzipped signed release. Expect one prompt, the new bundle in place, and no `.Keybase.app.updating` left. Cancel once and check for `ErrCanceled` with the old bundle untouched. Run the `codesign --verify … --test-requirement` command by hand on a signed release (pass) and on an ad-hoc-signed copy (fail) to settle its syntax.

## Risks / open questions

- **SPIKE:** whether `load_macfuse` runs as the user and what it returns when the kext is not approved (change 4 has a fallback).
- **SPIKE:** the live fstype string (expected `macfuse`) and the D30 mount point (changes 8–10 branch on it).
- **Decided (D38):** the `app` component is dropped on macOS. Correction to the earlier draft, which said it had no automatic caller: the updater's rename fallback (`platform_darwin.go:334-353`) calls it, and change 10 replaces that fallback with the D45 admin prompt.
- **Decided (D45):** the updater's rename fallback becomes a one-time `osascript` admin prompt sharing the D28 helper (changes 10 and 11). This replaces the earlier "accept losing auto-update" default.
- **Owner question (new, from D45):** the old fallback did not move the bundle as root (Current state correction). It swapped `Contents` in place as the user, with no prompt once the helper was installed. Under D45, upgraders who hit the rename failure and used to update silently now get an admin prompt on every such update. Try the unprivileged `Contents` swap first (signature-checked as `KBAppBundle.m` did) and prompt only if that fails, or prompt every time (D45 as written)? The spec assumes D45 as written.
- **Risk (D45):** in auto mode the updater applies only after the user has been idle for 5 minutes (Current state). So the prompt can appear with nobody at the Mac, time out after 5 minutes, and come back on a later hourly check. A cancel also comes back. **UNVERIFIED** how often users hit the rename failure at all. If it becomes a nuisance, a cap (stop prompting for a version after N cancels or timeouts) can be added later.
- **Risk, UNVERIFIED (D45):** that an `osascript` admin prompt from the launchd-agent updater reaches the user's GUI session. It runs in the user's own session (`~/Library/LaunchAgents`), so it should, but this is not checked.
- **Decided (D39):** a Settings button runs the same `clipaths` exec as the first-run prompt (change 11, 04 change 16).
- **Risk:** a machine with `kbfuse.fs` but no helper binary (user removed it by hand) cannot be cleaned without an admin prompt. The spec leaves it and logs; the kbfuse kext stays unused.
- **Risk:** helpers older than 1.0.47 (critical-update range < 1.0.44, `KBHelperTool.m:117-119`) may lack a method `--retire-helper` calls. **UNVERIFIED**; a failure there means retry forever. Consider a cap (stop retrying after N failures, logged).
- **Risk:** `osascript … with administrator privileges` from `keybase install`, exec'd by Electron, shows the standard auth dialog. **UNVERIFIED** that it appears when the app was opened at login before the user is active. The D39 button is user-initiated, so it does not have this problem.

## Log

| date | commit | note |
|------|--------|------|
