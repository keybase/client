# 03 — osx native + packaging

Status: [ ] not started

## Goal

Stop building, bundling, installing and loading kbfuse from `osx/` and `packaging/` (D1, D12). New installs get no privileged helper and no redirector (D25). `KeybaseInstaller` gains one switch, `--retire-helper`, that runs the D29 migration against the already-installed helper 1.0.47 without blessing a new one. The native side reports **no** macFUSE status; `keybase fuse status` (02) is the only source of truth. Merging waits on a signed, notarized `KeybaseInstaller` 1.1.95 (D33).

## Depends on

- `decisions.md`: D1, D9, D12, D14, D25, D28–D30, D33.
- **02-install-status-cli** stops exec'ing every installer switch this layer deletes (`--install/uninstall-fuse`, `-redirector`, `-helper`, `-cli`) and calls `--retire-helper` instead, treating any non-zero exit as "retry next launch" (D29, D33).
- **01-mounter** settles the D30 mount point (spike). It decides whether `--install-mountdir`/`--uninstall-mountdir` survive (only for the `~/Keybase` fallback's Finder sidebar entry). 01 also carries the darwin redirector packaging edits, because its build-tag change would otherwise break the darwin prerelease build.
- **04-ui** drops the consumers of exit codes 4, 6, 8 and 300 and keeps 5, which 02 generates (D31).

## Current state (verified on `nojima/macfuse-upstream` @ 6b06505404, 2026-10-06)

- `osx/Fuse/`: `README.md build.sh patch.sh rename.sh install.sh uninstall.sh fsbundle.tgz (37M) kbfuse.bundle/ (2.4M, incl. Resources/License.rtf)`. Read only by `osx/Fuse/`, `osx/Scripts/build.sh` and `packaging/desktop/kbfuse.sh`.
- `osx/Scripts/build.sh:62-63` ditto's `../../Fuse/kbfuse.bundle` into `<app>.app/Contents/Resources/`.
- `osx/Scripts/versions.sh:20-22,26,32-33` write `KBFuseVersion`/`KBFuseBuild` into `osx/Installer/Info.plist`; `:16-18,30-31` copy the helper version (stays). It runs as the Installer target's shell phase (`osx/Keybase.xcodeproj/project.pbxproj:580,786`).
- `osx/Installer/Info.plist:17-30`: installer 1.1.94, `KBFuse*` 5.0.6, `KBHelperVersion` 1.0.47; `:44` the `SMPrivilegedExecutables` requirement for `keybase.Helper`. `osx/Status/Info.plist:23-26` has stale `KBFuse*` 3.0.9.
- `osx/Installer/Installer.m:20-29` exit codes: 4 `FuseKextError`, 5 `FuseKextPermissionError`, 6 `AuthCanceled`, 7 `FuseKextMountsPresent`, 8 `FuseCriticalUpdate`. `uninstall` (`:103-113`) maps any error to 1. `checkError` (`:134-165`): the exit-8 branch (`:160-162`) lacks a `return`.
- `osx/Installer/Options.m:39-56` registers the switches; `:73-115` maps them. `uninstall-{app,fuse,mountdir,helper,cli,redirector}`, `uninstall` (`:91-93` sets `installOptions |= UninstallOptionAll`, a pre-existing bug), `install-{fuse,mountdir,redirector,helper,app-bundle,cli}`. `Options.h:14-25` defines `UninstallOptions`.
- `osx/Installer/Uninstaller.m:15-45` builds the uninstall list: mountdir, fuse, cli, helper, redirector, app.
- `osx/KBKit/KBKit/System/KBEnvironment.m:40-99` builds installables. `helperRequired = YES` for app bundle (`:52-55`), fuse (`:67-71`), mountdir (`:73-77`), redirector (`:79-83`) and cli (`:90-94`), which inserts `KBHelperTool` (bless + version check) first (`:96-99`). `:102` lists `_fuse` and `_helperTool` for the Status app's control panel.
- `KBHelperTool.m`: `HELPER_LOCATION` `/Library/PrivilegedHelperTools/keybase.Helper` (`:20`); XPC client for Mach service `keybase.Helper` (`:46`); install compares versions and calls `SMJobBless` (`:132-247`); critical update when the running helper is < 1.0.44 (`:117-119`, error `KBErrorCodeFuseCriticalUpdate` `:148`); "new version of macFuse" alert text (`:89,98-100`). `uninstall` (`:249-254`) removes only the binary and deliberately leaves the plist.
- `KBRedirector.m:32-77`: install sends `startRedirector` for `/keybase` (falls back to `/Volumes/Keybase` with `/keybase` as the link, `:53-59`); uninstall sends `stopRedirector {directory: redirectorMount}`, a no-op without the helper. Mount paths per run mode: `KBEnvConfig.m:196-210`.
- `KBMountDir.m`: creates `/Volumes/<x>` through the helper's `createMountDirectory` and any other path itself (`:100-117`, backup exclusion `:91-96`); adds/removes a Finder sidebar favorite through a symlink in the data dir (`:159-259`).
- `KBCommandLine.m:40-117`: `addToPath`/`removeFromPath` through the helper; `uninstallWithoutHelper` (`:85-90`) when absent.
- `KBFuseComponent.m` (281 lines): status via `keybase fuse status --bundle-version` (`:50-117`), install/load/fix through the helper, `uninstall` (`:203-216`) = helper `kextUninstall {destination:/Library/Filesystems/kbfuse.fs, kextID:com.github.kbfuse.filesystems.kbfuse}`. Users: `KBEnvironment` and `Uninstaller.m:24-30`.
- `KBDefines.h:36-39`: error codes -300…-303.
- Helper 1.0.47 (`osx/Helper/`, unchanged on this branch): XPC dispatch `KBHelper.m:85-120` (`version`, `kextLoad`, `kextUnload` with the `checkKextID` allow-list `:60-67`, `kextInstall`, `kextUninstall`, `kextCopy`, `remove`, `uninstallAppBundle`, `createMountDirectory`, `addToPath`, `removeFromPath`, `startRedirector`, `stopRedirector`). `stopRedirector` (`:354-367`) force-unmounts the directory and kills its redirector task. `remove` (`:529-541`) deletes any absolute path except `/`. `Info.plist:12-16` version 1.0.47, `KBBuild` 3. `keybase.Helper.plist` label `keybase.Helper`. `uninstall_helper.sh` documents the installed paths: `/Library/LaunchDaemons/keybase.Helper.plist`, `/Library/PrivilegedHelperTools/keybase.Helper`.
- Xcode: `osx/KBKit/KBKit.xcodeproj/project.pbxproj` references `KBFuseComponent`, `KBRedirector` and `KBCommandLine` (`:32-33,358-361,401-402,729-733,843-854,869-870,1404,1488,1531,1662,1712,1803`). KBKit is consumed as a pod with glob `KBKit/**/*.{h,m}` (`KBKit.podspec`), so the Installer build picks up deletions without those edits; the KBKit project still needs them. `osx/Keybase.xcodeproj/project.pbxproj:14,104,244,766` reference `osx/Resources/Fuse.icns` (used only by `KBFuseComponent.m:30`).
- Packaging: `package_darwin.sh:92-93` pulls prebuilt `KeybaseInstaller-1.1.94-darwin.tgz` (comment says it "installs KBFuse"); `packaging/desktop/kbfuse.sh` installs kbfuse from installer 1.1.93. The darwin redirector lines in `package_darwin.sh`, `prerelease/build_kbfs.sh` and `build_app.sh` are edited by 01.
- Prebuilt 1.1.94 (downloaded and inspected earlier): contains `kbfuse.bundle` and `Fuse.icns`; `KBFuseVersion` 5.0.6, `KBHelperVersion` 1.0.47; x86_64+arm64; notarized, not stapled.
- Docs: `osx/README.md:84-133`; `osx/Scripts/README.md:12,54`; `osx/.gitignore:25-26`; `osx/Resources/README.md:3` (Fuse.icns credit).
- CI: nothing references kbfuse/osxfuse/macfuse (`Jenkinsfile:668` is a Linux Go test).

## Changes

1. **Delete `osx/Fuse/`** and **`packaging/desktop/kbfuse.sh`** (D12).
2. `osx/Scripts/build.sh`: delete `:62-63`. `osx/Scripts/versions.sh`: delete `:20-22`, `:26`, `:32-33`. `osx/Installer/Info.plist` and `osx/Status/Info.plist`: remove `KBFuseBuild`/`KBFuseVersion` (`:23-26`).
3. **Installer switches** (`Options.m`, `Options.h`), kept in step with 02:
   - Delete `install-fuse`, `uninstall-fuse`, `install-redirector`, `uninstall-redirector`, `install-helper`, `uninstall-helper`, `install-cli`, `uninstall-cli` (D25, D28).
   - Add `retire-helper` (D29), a new `UninstallOptionRetireHelper`.
   - `install-mountdir`/`uninstall-mountdir`: keep only if the spike picks `~/Keybase` (D30); otherwise delete.
   - `install-app-bundle`/`uninstall-app`: unchanged pending the owner question in Risks.
   - `uninstall`: maps to retire-helper (plus mountdir under the fallback). Fix `:91-93` to set `uninstallOptions`, since the switch's meaning changes anyway.
4. **No helper on new installs (D25).** `KBEnvironment.m`: delete the fuse, redirector, helper and cli installables (`:48-50`, `:67-71`, `:79-83`, `:90-94`) and their `KBInstallOption*` flags in `KBEnvConfig.h` (leave the bit values unused, no renumbering). `KBMountDir` no longer sets `helperRequired` (`:73-77`). Only the app-bundle path can still require the helper. Drop `_fuse` from `_components` (`:102`).
5. **`KBMountDir`** (fallback only): delete the helper branch and `_isStandardKeybaseMountPath` (`:65-78`, `:106-116`); always self-create (`:80-98`, keeps the backup exclusion). The Finder favorite code stays: it is the D30 "add it to the Finder sidebar". Under the `/Volumes` outcome, delete `KBMountDir` with the switches.
6. **`--retire-helper` (D29).** New `-[KBHelperTool retireLegacy:]`. It never blesses or upgrades the helper:
   - If `HELPER_LOCATION` is absent: success, nothing to do.
   - Otherwise send, over the existing XPC client, in this order, stopping at the first error:
     1. `stopRedirector {directory: config.redirectorMount}` (same params as `KBRedirector.m:63-77`).
     2. If `/Library/Filesystems/kbfuse.fs` exists or the kext is loaded: `kextUnload {kextID: com.github.kbfuse.filesystems.kbfuse}`, then `kextUninstall {destination: /Library/Filesystems/kbfuse.fs, kextID: …}` (same params as `KBFuseComponent.m:203-216`).
     3. `remove {path: config.redirectorMount}` (`/keybase` in prod) if `lstat` finds it.
     4. `remove {path: /Library/LaunchDaemons/keybase.Helper.plist}`, then `remove {path: /Library/PrivilegedHelperTools/keybase.Helper}`. Last, so a failure earlier leaves the helper in place for the next launch's retry.
   - The helper process keeps running until reboot (D29). No helper version bump, so no admin prompt.
   - `Installer.m` routes `UninstallOptionRetireHelper` to it and exits `KBExitOK` or `KBExitError` (1). Go treats any non-zero as retry (D33).
7. **Delete now-unused KBKit code:** `KBFuseComponent.{h,m}`, `KBRedirector.{h,m}`, `KBCommandLine.{h,m}`, their `KBKit.h` imports (`:47,55,59`), `KBEnvironment.h` properties (`:14-15,23-24`), the KBKit pbxproj references above, `osx/Resources/Fuse.icns` with its `Keybase.xcodeproj` references and the `osx/Resources/README.md:3` credit. `Uninstaller.m` loses the fuse, cli, helper and redirector entries.
8. `KBDefines.h`: delete `-300`, `-301`, `-302`. Keep `-303` while the app-bundle path can still run the helper's critical-update check.
9. `Installer.m`: delete exit codes 4, 5 and 7 and their `checkError` branches, with a comment that they are retired and must not be reused (5 is now generated by Go, D31). Keep 6 and 8 while the app-bundle path exists. Add the missing `return` after the exit-8 branch.
10. `KBHelperTool.m`: delete the `bigSurFuse` alert text (`:89,98-100`). The install path stays only for the app-bundle question.
11. **Helper (`osx/Helper/`): no change** (D29). It stays at 1.0.47 and stays bundled in the installer, so the `--retire-helper` run talks to the same signed code. Deleting it is a later cleanup (Risks).
12. Docs: `osx/README.md:84-133` describes the remaining switches, `--retire-helper` and macFUSE from https://macfuse.io; `osx/Scripts/README.md` drops the KBFuse sentence (`:12`) and the `kbfuse.sh` bullet (`:54`); `osx/.gitignore` drops `:25-26`; `package_darwin.sh:92` comment → "installs services and CLI".

## Release gate (D33) and release-time steps (not done on this branch)

**Merging waits for a rebuilt, signed and notarized `KeybaseInstaller` 1.1.95 without kbfuse.** Until then the prebuilt 1.1.94 still bundles `kbfuse.bundle` (against D1), still honours `--install-fuse`, and rejects `--retire-helper`. 02 treats that as retry-next-launch, so the branch works but cannot migrate anyone.

1. Bump `osx/Installer/Info.plist` `CFBundleShortVersionString` + `CFBundleVersion` 1.1.94 → 1.1.95. Helper stays 1.0.47.
2. On a machine with the Keybase Developer ID cert (`osx/Scripts/README.md:14-31`): `cd osx && pod install`, then `osx/Scripts/build_installer.sh` → `osx/Scripts/build/KeybaseInstaller-1.1.95-darwin.tgz`. `lipo -archs` must show x86_64+arm64.
3. Notarize: `ditto -c -k --keepParent KeybaseInstaller.app i.zip && xcrun notarytool submit i.zip --keychain-profile NOTARY_PROFILE_LOGIN --wait`; stapling optional; re-tar. **UNVERIFIED** how 1.1.94 was notarized.
4. Check: no `kbfuse.bundle` in `Contents/Resources/`, no `KBFuse*` keys, `KBHelperVersion` 1.0.47, and `--retire-helper` in `--help` output.
5. Upload to `s3://prerelease.keybase.io/darwin-package/`; change `packaging/desktop/package_darwin.sh:93` to 1.1.95 in a release commit.

## Acceptance criteria

- `osx/Fuse/`, `packaging/desktop/kbfuse.sh`, `KBFuseComponent`, `KBRedirector`, `KBCommandLine` and `Fuse.icns` are gone.
- `git grep -n -i -e kbfuse -e osxfuse -- osx packaging` hits only `osx/Helper/` (unchanged legacy source) and the `--retire-helper` constants in `KBHelperTool.m`.
- `git grep -n -e install-fuse -e install-redirector -e install-helper -e install-cli -e KBFuseVersion -- osx packaging go` is empty.
- No installer switch reachable from Go can bless the helper: in `KBEnvironment.m`, only the app-bundle branch sets `helperRequired`.
- Installer contract: `--retire-helper` exits 0 when no helper is installed or all steps succeed, and 1 on the first failed step. It never touches `io.macfuse.*` or `/Library/Filesystems/macfuse.fs` (the helper's `checkKextID` allow-list, `KBHelper.m:60-67`, has no macFUSE entry anyway).
- `git diff master -- osx/Helper` is empty.

## How to verify

Without a signed build:
- The grep gates above; `plutil -lint osx/Installer/Info.plist osx/Status/Info.plist`; `bash -n osx/Scripts/build.sh`; `sh -n osx/Scripts/versions.sh`.
- Unsigned compile in a throwaway copy (so `Podfile.lock` does not churn): `pod install` in `osx/`, then `xcodebuild build -workspace Keybase.xcworkspace -scheme Installer -configuration Debug CODE_SIGNING_ALLOWED=NO`, and `-scheme Status`. **UNVERIFIED** that this builds under Xcode 27 (deployment targets 10.13/10.10, `project.pbxproj:1170-1376`, `Podfile:9`). If `master` fails too, record it and fall back to `clang -fsyntax-only` on the touched `.m` files.
- Unsigned run: `--run-mode=prod --app-path=/Applications/Keybase.app --timeout=10 --install-fuse` exits 1 (unknown switch). `--retire-helper` on a machine without the helper exits 0 with no XPC in the log.

Needs a signed build (the helper accepts only `keybase.Installer2`/`keybase.Keybase` signed by team 99229SGT5K, `KBHelper.m:37`): the end-to-end D29 run on a machine with the 1.0.47 helper, a `/keybase` redirector and `kbfuse.fs`, checking each path is gone afterwards, plus a run while another user holds a kbfuse mount (expect exit 1, then success after that user logs out).

## Risks / open questions

- **Owner decision:** `--install-app-bundle` / `--uninstall-app` still use the helper (bless on install). Keep it, so a helper appears only when someone runs `keybase install --components=app`, or drop the app component on macOS? The answer decides whether `KBHelperTool`'s install path, exit codes 6/8 and error -303 can be deleted now.
- **Owner decision:** D29 lists only `/keybase`. When the old redirector fell back to `/Volumes/Keybase` (`KBRedirector.m:53-59`), `/keybase` is a symlink and `/Volumes/Keybase` is the mount. Should step 1/3 also stop and `remove` `/Volumes/Keybase`? The same 1.0.47 methods do it, with no version bump.
- **Owner decision:** if D30 falls back to `~/Keybase`, the old helper-created `/Volumes/Keybase (<user>)` dir is left in `/Volumes` (root-owned parent, user cannot remove it). Add a `remove` of it to the retire run?
- **Owner decision:** when to delete `osx/Helper/` and stop bundling the helper in the installer. Not before the migration window closes, because `--retire-helper` needs the installed helper to accept the 1.1.95 installer.
- **Risk, UNVERIFIED:** helpers older than 1.0.47 may lack a method the retire run calls; that user then retries every launch (02 Risks proposes a cap).
- **Risk, UNVERIFIED:** whether `kmutil unload` plus deleting `kbfuse.fs` fully removes the kext from the auxiliary kext collection on Apple Silicon, or it lingers until reboot. The stale approval entry in System Settings likely remains (cosmetic).
- **Risk, UNVERIFIED:** removing the launchd plist of a loaded job leaves the job registered until reboot. If the helper exits early, launchd cannot relaunch it (binary gone); harmless, because nothing calls it after the run.
- **Risk:** GBCli rejecting an unknown switch (rather than ignoring it) is **UNVERIFIED**. If 1.1.94 ignores `--retire-helper`, it runs a no-op install and exits 0; 02 would then wrongly treat the retirement as done. 02 must re-check that the helper binary is gone after a 0 exit and treat its presence as a failure.
- `package_darwin.sh:234` re-signs Keybase.app with `--deep --force` (pre-existing, covered by dmg notarization).
- `KeybaseStatus` is not packaged; trimming its control panel is assumed fine.

## Log

| date | commit | note |
|------|--------|------|
