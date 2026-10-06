# 05 — Docs and repo audit

Status: [ ] not started

## Goal

Make sure nothing in the repo still assumes we ship kbfuse, a macOS `/keybase` redirector or a root helper on new installs, or can bless the helper at all (D38), and update the docs and the user-facing release notes to say that macOS users install stock macFUSE 5.x themselves (D1, D7, D9, D25, D44). This file is also the cross-check for layers 01–04: every reference below has an owner, and the grep gate at the end must pass once the whole effort is done.

## Depends on

01-mounter, 02-install-status-cli, 03-osx-packaging and 04-ui must have landed. The doc text describes what those layers built, so write it last (D21).

## Inventory

Taken on `nojima/macfuse-upstream` at `6b06505404` (= `origin/master`) on 2026-10-06. Search: `git grep -n -I -i -E 'kbfuse|osxfuse|fuse\.kext|\bkext|redirector|keybase\.Helper|Enable Keybase in Finder|macfuse'`, plus targeted greps for `use-system-fuse`, `ClosedSource`, `Fuse kext`, `KBFuse*`, `install-fuse`, `install-helper`, `install-cli`. Excluded: `node_modules`, `plans/`, `go/chat/unfurl/testcases`. `go/vendor` does not exist; the `bazil.org/fuse` replace (`go/go.mod:198`) lives in the module cache and defines `OSXFUSELocationV4`.

Owner key: **01** mounter · **02** install/status/CLI · **03** osx packaging · **04** UI · **05** this file · **R** allowed residual (see the grep gate) · **⚠** easy to miss.

### go/ — mounter, mount location, redirector

| path:line | what | owner |
|---|---|---|
| go/kbfs/libfuse/mounter_osx.go:27-32, 37-45, 64-76, 78-90 | `kbfusePath`, `UseSystemFuse` → V3, test locations, kbfuse error text | 01 |
| go/kbfs/libfuse/mounter_osx.go:92-97 | `reinstallMountDirIfPossible` execs `KeybaseInstaller --uninstall/install-mountdir` (would bless the helper) | 01 ⚠ |
| go/kbfs/libfuse/platform_flags_osx.go:14,25,33-34 | `--use-system-fuse` | 01 (D14) |
| go/kbfs/redirector/main.go:5,31-36,182-185,370-376; disable_dumpable.go:5 | darwin build, kbfuse paths and options. Linux keeps the package | 01 (D25) |
| go/mounter/mounter_osx.go:14,22; mounter_non_osx.go:12 | `IsMounted` matches `@kbfuse` | 01 (D26) |
| go/libkb/env.go:413-447 | darwin mount dir default `/Volumes/Keybase (<user>)` | 01 (D30, spike) |
| go/libkb/util.go:1013-1014 | darwin preferred dirs `/keybase`, `/Volumes/Keybase` | 01 ⚠ (D25) |
| go/service/kbfs_mount.go:38-70 | `WaitForMounts` waits for a preferred (redirector) dir | 01 ⚠ |
| go/libkb/env.go:685-692 | `GetRootRedirectorMount` also answers for darwin; only caller is `cmd_ctl_nix.go` (`!darwin`) | R |
| go/kbfs/libfuse/dir.go:233,267,420; file.go:143; folderlist.go:47; fs.go:312-313,458; start.go:67; go/kbfs/libfs/fs_notifications.go:91; tlf.go:51 | historical osxfuse comments, still accurate | R |

### go/ — install, status, CLI, service, updater

| path:line | what | owner |
|---|---|---|
| go/install/fuse_status_darwin.go:22,36,48,77,107 | kbfuse path, kext ID, `mountInfo("kbfuse")`, index bug | 02 |
| go/install/install_darwin.go:51-56,410-481 | helper exit codes, `InstallAuto` with helper/fuse/mountdir/redirector, `installFuse` | 02 |
| go/install/install_darwin.go:523-602,613-635,639-645 | helper + critical update, mountdir, redirector, clipaths via the helper | 02 (D25, D28) |
| go/install/install_darwin.go:771-779 | mount only if the mount dir exists | 02 (D27, D30) |
| go/install/install_darwin.go:822-914,916-935 | `Uninstall` redirector/fuse/helper/clipaths; `UninstallKBFSOnStop` mountdir | 02 |
| go/install/install_darwin.go:499-505,881-887; libnativeinstaller/app.go:140-150; go/client/cmd_install_osx.go:52-55,308-311 | `app` component (`--install-app-bundle`/`--uninstall-app`) and `--source-path` | 02 (D38) |
| go/updater/keybase/platform_darwin.go:334-353 | rename-failure fallback runs `keybase install --components=app` | 02 ⚠ (D38: the only automatic caller) |
| go/install/libnativeinstaller/app.go:81-137 | `--install/uninstall-{mountdir,redirector,fuse,helper,cli}` wrappers | 02 |
| go/client/cmd_install_osx.go:87-96,166-175 | default install/uninstall components include helper, fuse, mountdir, redirector | 02 ⚠ (plain `keybase install` must stay green without macFUSE) |
| go/client/cmd_fuse_osx.go:29-35,46,60 | "Status for fuse…", `--bundle-version` | 02 |
| go/service/install.go:28-62 | `InstallFuse` {helper, fuse}, `InstallKBFS` {…, redirector}, `UninstallKBFS` {redirector, …, fuse} | 02 |
| go/updater/keybase/platform_darwin.go:207-211 | `keybase uninstall --components=redirector` before an update | 02 ⚠ |
| go/install/install.go:58-65,94-98 | `ComponentNameHelper`, `ComponentNameRedirector` (cross-platform list) | R |
| go/install/install.go:55; go/client/cmd_ctl.go:36, cmd_ctl_start_osx.go:105, cmd_ctl_stop_osx.go:77 | `ComponentNameApp`, also the GUI app for `keybase ctl start/stop` | R (not an install path) |
| go/client/cmd_kbfs_mount.go | `//go:build windows` (`:4`): not macOS | R (D4) |

### protocol/ (generated outputs noted, never edited by hand)

| path:line | what | owner |
|---|---|---|
| protocol/avdl/keybase1/install.avdl:44-60 | `FuseMountInfo`, `FuseStatus.kextID`, `kextStarted` | R (still kext mode, D7) |
| protocol/avdl/keybase1/constants.avdl:114-115 | `SCLoadKextError`, `SCLoadKextPermError` | R |
| protocol/bin/enabled-calls.json:332-335 | `fuseStatus`, `installFuse`, `installKBFS`, `uninstallKBFS` | R (D31 keeps `installFuse`) |
| generated: protocol/json/keybase1/*, go/protocol/keybase1/*, shared/constants/rpc/rpc-gen.tsx, osx/KBKit/KBKit/RPC/KBRPC.{h,m} | copies of the above | R (no avdl change, 02 change 1) |

### osx/

| path:line | what | owner |
|---|---|---|
| osx/Fuse/** | kbfuse build and bundle | 03 (delete, D12) |
| osx/.gitignore:25-26 | `osxfuse`, `macfuse` build dirs | 03 ⚠ |
| osx/Scripts/build.sh:62-63; versions.sh:20-22,26,32-33 | bundle copy, `KBFuse*` versions | 03 |
| osx/Installer/Info.plist:23-26; osx/Status/Info.plist:23-26 | `KBFuse*` keys | 03 ⚠ |
| osx/Installer/Installer.m:20-29,134-165 | exit codes 4–8 | 03 (D38: only 0/1 remain) |
| osx/Installer/Options.{h,m} | `--install/uninstall-{fuse,redirector,helper,cli}`, `--install-app-bundle`, `--uninstall-app`, `--source-path`; new `--retire-helper` | 03 (D25, D28, D29, D38) |
| osx/Installer/Uninstaller.m:15-45 | fuse, cli, helper, redirector, app uninstall | 03 |
| osx/Installer/Info.plist:41-45; osx/Status/Info.plist:39-43 | `SMPrivilegedExecutables` | 03 (D38) |
| osx/KBKit/KBKit/Component/KBAppBundle.* | privileged app-bundle move through the helper | 03 (delete, D38) |
| osx/KBKit/KBKit/Component/KBFuseComponent.*, KBRedirector.*, KBCommandLine.* | kbfuse, redirector and helper `addToPath` components | 03 (delete) |
| osx/KBKit/KBKit/System/KBEnvironment.m:47-102; KBEnvConfig.h; KBKit.h:47,55,59; KBDefines.h:36-39 | installables, `helperRequired`, error codes | 03 |
| osx/KBKit/KBKit/Component/KBHelperTool.m:20,41-254 | helper path, version check, critical update, macFuse alert, `SMJobBless`, uninstall leaving the plist; keeps the XPC client and `remove`, gains `retireLegacy:` | 03 (D38) |
| osx/KBKit/KBKit/Component/KBMountDir.m:65-117 | helper `createMountDirectory` branch | 03 (D30 decides keep/delete) |
| osx/KBKit/KBKit.xcodeproj/project.pbxproj (KBFuseComponent/KBRedirector/KBCommandLine refs); osx/Keybase.xcodeproj/project.pbxproj:14,104,244,766 + osx/Resources/Fuse.icns + osx/Resources/README.md:3 | build refs and icon | 03 |
| osx/Helper/** | helper 1.0.47 source, unchanged (D29) | R (deleted and unbundled one or two releases after ship, D42, tracked in README) |
| osx/README.md:84-133; osx/Scripts/README.md:12,54 | docs | 05 |

### packaging/

| path:line | what | owner |
|---|---|---|
| packaging/desktop/kbfuse.sh | installs kbfuse from KeybaseInstaller.app | 03 (delete) |
| packaging/desktop/package_darwin.sh:39,99,148-149,194,241 | darwin `keybase-redirector` resolve/copy/verify | 01 (same commit as the build tag) |
| packaging/prerelease/build_kbfs.sh:36-37,44; build_app.sh:126 | darwin redirector build and codesign | 01 |
| packaging/desktop/package_darwin.sh:92-93 | installer 1.1.94 and "installs KBFuse" comment | 03 (1.1.95 at release, D33) |
| packaging/linux/** (systemd `keybase-redirector.service`, `post_install.sh`, `run_keybase`, smoketest) | Linux redirector | R (D4) |

### shared/

| path:line | what | owner |
|---|---|---|
| shared/fs/common/hooks.tsx:1384-1411 | `useFuseClosedSourceConsent` | 04 (D13) |
| shared/fs/common/sfmi-popup.tsx:4,20,45; fs/banner/system-file-manager-integration-banner/container.tsx:289,301 | consent use; "Enable Keybase in …?" | 04 (D17) |
| shared/fs/banner/system-file-manager-integration-banner/kext-permission-popup.tsx | Gatekeeper-era kext steps | 04 (D18, D35) |
| shared/fs/routes.tsx:148-153; shared/settings/files/index.tsx:55-125 | `kextPermission` route; Finder toggle | 04 (D36) |
| shared/fs/common/sfmi.tsx:50-117,308-321; constants/fs.tsx:170-174; constants/types/fs.tsx:390 | `kextPermissionError` (kept as NeedsKextApproval, D31) | 04 |
| shared/util/fs-platform.tsx:17-36,134-206 | status mapping, enable/disable flows | 04 |
| shared/constants/values.tsx:5-11 | exit codes 4, 5, 6, 8, 300 | 04 ⚠ (5 stays, D31; D38) |
| shared/desktop/app/installer.desktop.tsx:65-109,187-204 | device-slots text, helper and redirector branches; `clipaths` prompt | 04 ⚠ (D25, D28, D38) |
| shared/constants/remote-actions.tsx:21,77-78,121,152; desktop/renderer/remote-event-handler.desktop.tsx:129-132; stores/shell.tsx:28,41,70,205-210; router-v2/tab-bar.desktop.tsx:252-253; constants/init/shared.tsx:470-480 | critical-update badge, fed only by installer exit 8 | 04 ⚠ (D38, dead code) |
| shared/settings/advanced.tsx:263-265 | where the "Install command line tool" button goes | 04 (D39) |
| shared/desktop/app/kb2-impl.desktop.tsx:18-64; util/electron.tsx:29-67 | no `arch` constant | 04 (D35) |
| shared/desktop/app/ipc-handlers.desktop.tsx:331-342 (+ ipctypes, preload, electron.tsx) | `uninstallKBFSDialog`, `relaunchApp` | 04 |
| shared/desktop/app/ipc-handlers.desktop.tsx:277 | `kextStarted: true` (Windows Dokan path) | R (D4) |
| shared/docs/installer_and_updater_architecture.md:12,18-19,42,60,68 | kbfuse, helper, broken link | 05 |
| shared/desktop/CHANGELOG.txt | user-facing release notes | 05 (D44) |

### Tests and CI

- No Go or TS test, story or e2e references kbfuse or the darwin redirector. The only native test is `osx/Helper/KBHelperTest.m` (unchanged, R).
- `Jenkinsfile:666-680` runs `go/kbfs/test -tags fuse` and `go/kbfs/libfuse` only under `test_linux_go_`. No macOS FUSE CI exists. `.github/workflows/` has only `issues.yml`.

## Doc changes

1. **shared/docs/installer_and_updater_architecture.md**
   - `:12` item 3 → "FUSE is not shipped. macOS users who want KBFS in Finder install stock macFUSE 5.x from https://macfuse.io (kext mode)."
   - `:18-19` and `:42`: no privileged helper on new installs (D25). The installer's only privileged job is the one-time `--retire-helper` run for upgraders (D29); the CLI symlink uses a one-time admin prompt (D28).
   - `:60` broken link `go/client/install_osx.go` → `go/client/cmd_install_osx.go`.
   - `:68` `keybase fuse status` reports the stock macFUSE install (D14).
2. **go/kbfs/README.md**: `:68-70` the redirector is mounted at `/keybase` on Linux only (D25); `:95` and `:111-113` "FUSE for OS X"/osxfuse.github.io → macFUSE (https://macfuse.io), delete the `--use-system-fuse` bullet (D14); `:123-127` delete the "branded version of FUSE for OS X" paragraph and its `osx/Fuse/build.sh` link.
3. **osx/README.md:84-133**: drop `helper`, `fuse`, `mountdir` and `redirector` from the `keybase install --components=…` example and the `install-auto` list; drop `install-app-bundle` (`:125`) and `uninstall-app` (`:133`) (D38); list the remaining installer switches, including `--retire-helper` (D29); say Finder access needs macFUSE from https://macfuse.io.
4. **osx/Scripts/README.md**: delete `:12` ("If you updated KBFuse…") and the `:54` `kbfuse.sh` entry. Add the D33 release step (rebuild, sign, notarize installer 1.1.95), pointing at 03's release section.
5. **CLI help** (owned by 02, checked here): `cmd_fuse_osx.go:35` → "Status of the macFUSE install"; `install --components=fuse` prints the macfuse.io message (D14, D32).
6. **In-app help text** (owned by 04, checked here): `kext-permission-popup.tsx`, `installer.desktop.tsx`.
7. **No change:** `go/README.md:15` (FUSE in general), `packaging/linux/*` (D4).
8. **No man pages** are tracked (the only `*.1` file is `go/libkb/testfixtures/f.testlog.1`).
9. **Release notes (D44): `shared/desktop/CHANGELOG.txt`.** One bullet per line, each starting with `• ` (bullet, space); no header, no version (verified: the file is 3 lines today and is rewritten wholesale for each release, e.g. `f60f2ff97e` "6.6.3 changelog"). It becomes the update's `--description` for both macOS (`packaging/desktop/package_darwin.sh:298`) and Windows (`packaging/windows/doinstaller_wix.cmd:153,170`), so the entry says "macOS" up front. Add, keeping the existing lines:
   ```
   • macOS: Keybase no longer bundles its own FUSE. To use Keybase in Finder, install macFUSE 5 or later from macfuse.io. The old Keybase FUSE is removed automatically.
   • macOS: /keybase is gone. Your files are at {D30 mount point}.
   ```
   Fill in `{D30 mount point}` from the spike (`/Volumes/Keybase (<user>)` or `~/Keybase`). Whoever writes the release's changelog commit must keep these two lines.

`go/CHANGELOG.md` is frozen at 1.0.19 (2019); leave it. The PR description repeats the two CHANGELOG bullets.

## Grep gate

Run from the worktree root once 01–04 have landed. Every check must print nothing.

```sh
cd "$GOPATH/src/github.com/keybase/client-macfuse"
X=(-- ':!plans' ':!*node_modules*' ':!go/chat/unfurl/testcases')
# A. Gone entirely.
git grep -n -I -E 'use-system-fuse|UseSystemFuse|ClosedSourceConsent|closed-source kernel extension|KBFuseVersion|KBFuseBuild|kbfuse\.bundle|desktop/kbfuse\.sh|Fuse kext|Security & Privacy|OSXFUSELocationV3|/dev/kbfuse|mount_kbfuse|KBFuseComponent|KBRedirector|KBCommandLine|KBAppBundle|install-fuse|install-redirector|install-helper|install-cli|install-app-bundle|uninstall-app|components=app|uninstallKBFSDialog|setCriticalUpdate|fsCriticalUpdate|ExitFuseCriticalUpdate|ExitCodeAuthCanceledError|ExitCodeFuseKextError' "${X[@]}"
# A2. Nothing outside the legacy helper source can bless it (D38).
git grep -n -I -E 'SMJobBless|SMPrivilegedExecutables|KBErrorCodeFuse' "${X[@]}" ':!osx/Helper'
test -e osx/Fuse && echo "osx/Fuse still present"
test -e packaging/desktop/kbfuse.sh && echo "kbfuse.sh still present"
# B. kbfuse / osxfuse only in allow-listed files.
git grep -n -I -i -E 'kbfuse|osxfuse|fuse\.kext' "${X[@]}" \
  | grep -v -E 'OSXFUSE(Location|Paths)|ErrOSXFUSENotFound' \
  | grep -v -E '^(osx/Helper/|osx/KBKit/KBKit/Component/KBHelperTool\.m|go/mounter/mounter_osx\.go|go/install/(fuse_status|install)_darwin\.go|go/kbfs/libfuse/(dir|file|folderlist|fs|start)\.go|go/kbfs/libfs/(fs_notifications|tlf)\.go):'
# C. The redirector exists only for Linux.
git grep -n -I -E 'keybase-redirector|startRedirector|stopRedirector' "${X[@]}" \
  | grep -v -E '^(packaging/linux/|go/kbfs/redirector/|go/client/cmd_ctl_(nix|autostart)\.go|go/install/stop_nix\.go|go/status/log_send\.go|go/kbfs/README\.md|packaging/prerelease/build_kbfs\.sh|osx/Helper/|osx/KBKit/KBKit/Component/KBHelperTool\.m):'
# D. No Go path execs a helper-installing installer switch (D25, D38).
git grep -n -E 'libnativeinstaller\.(Install|Uninstall)(Fuse|Redirector|Helper|CommandLinePrivileged|AppBundle|App)\b' -- go
```

Allowed residuals, each with a reason:

- `osx/Helper/**`: the 1.0.47 helper source, unchanged so the D29 run talks to known code. Deleted, and no longer bundled, one or two releases after ship (D42, tracked in `README.md`); not on this branch.
- `KBHelperTool.m`: `retireLegacy:` names `kbfuse.fs`, the kbfuse kext ID and `stopRedirector` (D29).
- `go/mounter/mounter_osx.go` (`kbfuse` fstype, D26) and `go/install/{fuse_status,install}_darwin.go` (`legacyKbfusePath`, `retireLegacyHelper`). Each hit has "legacy" or a D26/D29 reference on that line or the one above.
- `go/kbfs/libfuse/*`, `go/kbfs/libfs/*` historical osxfuse comments.
- Linux redirector files in gate C (D4).
- bazil identifiers `OSXFUSELocations`, `OSXFUSELocationV4`, `OSXFUSEPaths`, `ErrOSXFUSENotFound` (filtered).
- `kext` is not gated: protocol fields, `SCLoadKext*` and the macFUSE approval UI (D18) are accurate under kext mode (D7).

## Acceptance criteria

- [ ] Every Inventory row is changed by its owning layer or listed as an allowed residual; the ⚠ rows are covered in their layer specs.
- [ ] Grep gates A–D print nothing with the final allow-lists.
- [ ] Doc changes 1–4 and 9 (the `CHANGELOG.txt` bullets, D44) made; 5–6 confirmed against what 02 and 04 shipped.
- [ ] `keybase install` with no `--components` exits 0 on a Mac without macFUSE (cmd_install_osx.go ⚠ row).
- [ ] The two `CHANGELOG.txt` bullets are repeated in the PR description when a PR is opened (D21, D44).
- [ ] This spec and `README.md` updated in the same commit (D23).

## Risks / open questions

- **Exit codes are mirrored** in `Installer.m:20-29`, `install_darwin.go:51-56` and `values.tsx:5-11`. After 03 only 0/1 come from the installer (D38); 5 is Go's (D31) and is the only code `values.tsx` keeps. Check all three agree.
- Whether to reword the historical osxfuse comments is undecided; the default is to leave them (R).
- The release's own changelog commit replaces `CHANGELOG.txt` wholesale; if it lands after this branch, the D44 bullets can be lost. Point the release owner at them.

## Log

| date | commit | note |
|---|---|---|
