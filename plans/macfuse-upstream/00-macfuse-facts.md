# 00 — Stock macFUSE 5.x facts

Status: ✓ reference (no code). Checked 2026-10-06 against `nojima/macfuse-upstream` @ 6b06505404. Nothing was downloaded or installed, and macFUSE is **not** installed on the dev box, so no fact here comes from a live install. Items the spike in `01-mounter.md` must answer are marked **SPIKE**; facts nobody can check from here are **UNVERIFIED**.

Abbreviations:
- **LIB** = `macfuse/library` at `fe59bf43` (the `Library-2` submodule pinned by `macfuse/macfuse@release/macfuse`): `https://github.com/macfuse/library/blob/fe59bf43f1a2f249ed8d82c7d28739121ee703a2/<path>`.
- **WIKI** = `https://github.com/macfuse/macfuse/wiki/<page>`.
- **REL** = `https://github.com/macfuse/macfuse/releases/tag/<tag>`.
- **FORK** = `~/go/pkg/mod/github.com/keybase/fuse@v0.0.0-20210104232444-d36009698767/` (the `bazil.org/fuse` replace in `go/go.mod:198`).
- **KBB** = `osx/Fuse/kbfuse.bundle` on this branch: macFUSE 5.0.6 run through `osx/Fuse/rename.sh` (`macfuse`→`kbfuse`, `io.macfuse`→`com.github.kbfuse`). A KBB fact gives the stock name by reversing that rename, so it is *derived*, not observed.

The kext is closed source (`README.md` on `release/macfuse`: "The other components, e.g. the macFUSE kernel extension, are closed-source"). `load_macfuse` and `mount_macfuse` are closed source too. Anything about their internals is derived from KBB or third parties.

## 1. Versions and macOS support

| Fact | Value | Source |
|---|---|---|
| Latest release | **5.4.0** (2026-09-07). Kext version also 5.4.0 | REL `macfuse-5.4.0`; `gh api repos/macfuse/macfuse/releases` |
| Latest supported macOS | "macOS 12 to macOS 27" | `https://github.com/macfuse/macfuse/blob/release/macfuse/README.md` |
| 5.0.0 / 5.0.1 minimum | macOS 11 ("Drop support for macOS 10.9 to 10.15. macFUSE 5 supports macOS 11 and later") | REL `macfuse-5.0.0` |
| 5.0.2+ minimum | **macOS 12** ("Drop support for macOS 11") | REL `macfuse-5.0.2` |
| 5.0.7 restates it | "macFUSE 5 supports macOS 12 through macOS 26" | REL `macfuse-5.0.7` |
| Site download box | "macOS 12 or later" | https://macfuse.io (302 → https://macfuse.github.io/) |
| Update feed | `https://macfuse.github.io/releases/CurrentRelease.plist` has rules for ProductVersion 12, 13, 14, 15, 16, 26, 27, all pointing at 5.4.0. ProductID `com.github.osxfuse.OSXFUSE` | fetched directly |
| kbfuse today | 5.0.6, `LSMinimumSystemVersion` 12.3 (Keybase built with `-d 12.3`) | KBB `Contents/Info.plist`; `osx/Fuse/build.sh` |

**For D10:** require `>= 5.0` per the decision. The macOS floor that follows is **macOS 12** for any 5.x we would ask users to install, because 5.0.2+ needs 12. 5.0.0 and 5.0.1 also ran on macOS 11, but nobody can download them from macfuse.io now.

## 2. Install layout (kext backend)

| Path | Notes | Source |
|---|---|---|
| `/Library/Filesystems/macfuse.fs` | fs bundle. Designated requirement: `identifier "io.macfuse.filesystems.fs.macfuse"` plus team `3T5GSNBU6W` | autopkg `apizz-recipes/macFUSE/macFUSE.download.recipe` L95–97 (third party) |
| `…/Contents/Info.plist` | `CFBundleShortVersionString` = marketing version, which autopkg reads as "version". `CFBundleVersion` is the same string in KBB. `LSMinimumSystemVersion` is also present | autopkg recipe L157–162; KBB `Contents/Info.plist` |
| `…/Contents/version.plist` | `CFBundleShortVersionString`, `CFBundleVersion`, `ProjectName`=`macFUSE`. Derived from KBB | KBB `Contents/version.plist` |
| `…/Contents/Resources/mount_macfuse` | mount helper (`FUSE_MOUNT_PROG`) | LIB `lib/fuse_darwin.h` L19 |
| `…/Contents/Resources/load_macfuse` | kext loader | FORK `options.go:283`; KBB `Resources/load_kbfuse` |
| `…/Contents/Resources/Volume.icns` | default volume icon | LIB `lib/fuse_darwin.h` L23 |
| `…/Contents/Extensions/<macOS major>/macfuse.kext` | one directory per macOS major. The wiki's manual-load command uses `Extensions/15/macfuse.kext` and says "Replace the '15' … with the major version number of the current macOS". In KBB, `12/` is a real dir and `13`, `14`, `15`, `26` are symlinks to `12`. The 5.4.0 set of directories (does it add `27`?) is **UNVERIFIED** | WIKI `Getting-Started` (Troubleshooting); KBB `Contents/Extensions/` |
| `/Library/Frameworks/macFUSE.framework` | ObjC framework | autopkg recipe L112 |
| `/Library/PreferencePanes/macFUSE.prefPane` | preference pane, which also handles updates | autopkg recipe L142; Homebrew cask `zap` |
| launchd jobs `io.macfuse.app.launchservice.broker` and `io.macfuse.app.launchservice.daemon` | 5.x helper services. Where their binaries live is **UNVERIFIED** | Homebrew cask `Casks/m/macfuse.rb` `uninstall launchctl:` |
| pkg receipts `io.macfuse.installer.components.core` and `io.macfuse.installer.components.preferencepane` | `pkgutil --pkg-info` can check that macFUSE is installed | Homebrew cask `uninstall pkgutil:` |
| `/usr/local/lib`, `/usr/local/include` | libfuse dylibs and headers. The cask fixes their ownership after install | Homebrew cask `postflight_steps` |

Homebrew cask (`https://github.com/Homebrew/homebrew-cask/blob/master/Casks/m/macfuse.rb`): version 5.4.0, `pkg "Extras/macFUSE #{version}.pkg"`, `auto_updates true`, `caveats { kext }`. The wiki recommends macfuse.io over package managers, which "are not managed by the macFUSE developers" (WIKI `Getting-Started`).

### Mount point under `/Volumes` (D30, D37)

| Fact | Value | Source |
|---|---|---|
| `/Volumes` ownership and mode | `root:wheel`, mode `755`. A normal user cannot create `/Volumes/Keybase (<user>)` | `stat -f '%Su:%Sg %Lp' /Volumes` on the dev box, macOS 27.0.1, 2026-10-06 |
| Who creates the mount dir today | the kbfuse-era helper, as root: `createMountDirectory` only accepts `/Volumes/<name>` (`osx/Helper/KBHelper.m:175-191,233-241`), called by `KBMountDir` (`osx/KBKit/KBKit/Component/KBMountDir.m:100-117`). With no helper (D25) nothing can create it | code |
| Does `mount_macfuse` create a missing `/Volumes/<name>` itself (and remove it on unmount)? | **SPIKE** (first check in `01-mounter.md`). Its answer settles D30 | closed source |

## 3. Kernel identifiers

| Fact | Stock value | How established |
|---|---|---|
| Kext bundle ID | `io.macfuse.filesystems.macfuse` | derived from `rename.sh` L19 (`io.kbfuse.filesystems.kbfuse` → `com.github.kbfuse…`); corroborated by third parties: chainguard `osquery-defense-kit` kext allowlist (`…/macfuse.fs/Contents/Extensions/14/macfuse.kext,io.macfuse.filesystems.macfuse`), many READMEs using `kextunload -b io.macfuse.filesystems.macfuse`. No first-party doc states it |
| Developer Team ID | `3T5GSNBU6W` (Benjamin Fleischer) | autopkg codesign requirement; third-party `KextPolicy` inserts |
| Device nodes | `/dev/macfuse0`, `/dev/macfuse1`, … | FORK `options.go:282` (`DevicePrefix: "/dev/macfuse"`); KBB `mount_kbfuse` strings `/dev/kbfuse%d` |
| fstype (`mount` output, `statfs.f_fstypename`) | `macfuse` (D26 matches `macfuse` and legacy `kbfuse`) | WIKI `Mount-Options` § fstypename: the option "would cause the in-kernel file system type to be `macfuse_NAME`" and bundle `macfuse_NAME.fs` "instead of the usual `macfuse.fs`". Kbfuse equivalent: `go/install/fuse_status_darwin.go:77` (`mountInfo("kbfuse")`), `KBFuseComponent.m:126`. Exact string on a live mount: **SPIKE** |
| sysctl tree | `vfs.generic.macfuse.*`. Documented: `vfs.generic.macfuse.tunables.admin_group`. Also `vfs.generic.macfuse.version.number`, which only exists while the kext is loaded | WIKI `Mount-Options` § allow_other; KBB strings `vfs.generic.kbfuse.version.number`; VeraCrypt `src/Core/Unix/MacOSX/CoreMacOSX.cpp` uses `sysctlbyname("vfs.generic.macfuse.version.number")` as its "is macFUSE loaded" check |
| Loaded check | `kmutil showloaded --bundle-identifier io.macfuse.filesystems.macfuse` / `kextstat -b io.macfuse.filesystems.macfuse`. Cheaper checks that need no kmutil: `/dev/macfuse0` exists, or the sysctl above resolves | standard Apple tooling; FORK `mount_darwin.go:33` uses the `/dev/<prefix>0` check |

## 4. Mount helper protocol (`mount_macfuse`)

Environment and argv, as set by stock libfuse (LIB `lib/mount_darwin.c`):

| Env / arg | Value | LIB line | FORK |
|---|---|---|---|
| `_FUSE_CALL_BY_LIB` | `"1"` (kext backend only) | L671–672 | `mount_darwin.go:164` sets `""`. Also sets legacy `MOUNT_FUSEFS_CALL_BY_LIB` / `MOUNT_OSXFUSE_CALL_BY_LIB` (L160, L162), which are harmless |
| `_FUSE_DAEMON_PATH` | daemon's own path | L476 | `options.go:285` `DaemonVar`, set at `mount_darwin.go:167–168` from `os.Args[0]` |
| `_FUSE_COMMFD` | socketpair fd number. The helper sends the opened `/dev/macfuseN` fd back over it (SCM_RIGHTS) | L480; `receive_fd` L512 | `mount_darwin.go:187`; `receiveDeviceFD` L102–135 |
| `_FUSE_COMMVERS` | `"2"`: the helper also reports mount status over the socket (LIB commit `c6a59bed` 2020-10-19, "Add support for passing mount status to libfuse") | L481 | **not set** by FORK, so it relies on the helper's version-1 behaviour. Works with kbfuse 5.0.6 today (same binary). That 5.4.0 keeps version 1: **SPIKE** |
| argv | `mount_macfuse -o <opts> [-q] <mountpoint>` | L483–491 | `mount_darwin.go:146–156` (`-o opts -o iosize=N dir`) |
| `backend=fskit` | switches to FSKit/MFMount. Without it the kext is used, which is the default | L668; WIKI `FUSE-Backends` | not passed, so FORK gets the kext |

Also `mount_kbfuse` (KBB) contains the strings `_FUSE_CALL_BY_LIB`, `_FUSE_COMMFD`, `_FUSE_COMMVERS`, `_FUSE_DAEMON_PATH`, `FUSE_DEV_FD` and `FUSE_DEV_NAME`, so the 5.0.6 helper reads exactly these.

Exit status 64 from the helper is treated as "boring" by FORK (`mount_darwin.go:94–101`). What stock 5.x exit codes mean is **UNVERIFIED** (closed source).

## 5. Mount options relevant to a network-backed FS (kext backend)

All are documented on WIKI `Mount-Options` and passed through as `KEY_KERN` in LIB `lib/mount_darwin.c` L64–176.

| Option | Documented effect | Used by KBFS today |
|---|---|---|
| `volname=NAME` | volume name | yes, `fuse.VolumeName` (`mounter_osx.go:53`) |
| `local` | marks the volume local. By default volumes are "non-local", which Finder treats much like a network volume. Local is "experimental… use with caution" | only when `UseLocal` (`mounter_osx.go:56–57`) |
| `excl_create` | in LIB opts table (L143). Not on the wiki page | yes, `fuse.ExclCreate()` (`mounter_osx.go:54`) |
| `iosize=N` | power of 2, 16 KiB (AS) / 4 KiB (Intel) up to 32 MiB, default 64 KiB. "small I/O block size" recommended for slow links | FORK always passes `iosize=maxWrite` (`mount_darwin.go:156`) |
| `daemon_timeout=N` | default 60 s. On timeout the volume is ejected | available (`options.go:154`) |
| `noappledouble` | denies `._*` and `.DS_Store` | available (`options.go:96`) |
| `noapplexattr` | denies `com.apple.*` xattrs | available (`options.go:105`) |
| `nobrowse` | Finder will not browse the volume automatically | available (`options.go:113`) |
| `allow_other` / `allow_root` | privileged: needs root or the macFUSE admin group (`vfs.generic.macfuse.tunables.admin_group`, default 80). Needed for Spotlight | available (`options.go:163`) |
| `negative_vncache` | do **not** use when objects can appear outside macFUSE's knowledge, e.g. a remote FS | — |
| `auto_cache`, `nolocalcaches`, `noubc`, `novncache`, `slow_statfs`, `fsname=`, `fstypename=`, `volicon=`, `jail_symlinks`, `defer_permissions` | documented, not used by KBFS | — |

## 6. Kext approval (kext backend)

From WIKI `Getting-Started`, sections "macOS 13 and later" (the wiki has no separate macOS 15 or 26 text):

1. **Apple Silicon only, first time any third-party kext is used:** a prompt appears. Click "Open System Settings", which opens Privacy & Security. Click "Enable System Extensions…" and enter the password. Click "Shut Down". Hold Touch ID or the power button to reach Recovery → Startup Security Utility. Select the volume, then "Security Policy…". Choose "**Reduced Security**" and enable "**Allow user management of kernel extensions from identified developers**". Click OK, enter the password, restart.
2. **Apple Silicon and Intel, first use and after every macFUSE update:** a prompt appears. Click "Open System Settings", then the "**Allow**" button, and enter the password. "After restarting your Mac you can use macFUSE."
3. Troubleshooting from the same page: with no "Allow" button, run `sudo kmutil load -p /Library/Filesystems/macfuse.fs/Contents/Extensions/<major>/macfuse.kext`. Third-party kexts cannot load when booted from an external volume or inside a VM. Incompatible old kexts (BlackBerry USB, old OpenZFS) can block macFUSE.
4. Homebrew cask caveat: "If the installation fails, retry after you enable it in: System Settings → Privacy & Security".

Telling "installed but not approved" apart from other failures:
- FORK calls `load_macfuse` only when `/dev/macfuse0` is missing (`mount_darwin.go:30–38`). It runs as the calling user, so the stock binary must be setuid root. KBB's `install.sh:21` does `chmod +s`. Whether stock `load_macfuse` is setuid: **SPIKE** (`ls -l` on the installed bundle).
- `load_macfuse`'s exit codes and stderr when policy denies the kext: **SPIKE** (D31; closed source, not documented).
- Today kbfuse detects denial through the privileged helper's `KextManager` load, matching the error suffix `-603946981` (`osx/KBKit/KBKit/Component/KBFuseComponent.m:136`). That is `0xDC00801B` = `kOSKextReturnSystemPolicy` (Apple `libkern/OSKextLib.h`). Under D25 there is no helper, so this signal is gone. D31 replaces it: `installFuse` runs `load_macfuse` and maps a failure to exit code 5.
- What a client can observe cheaply, without root: is the bundle present (`/Library/Filesystems/macfuse.fs/Contents/Info.plist`), is the kext loaded (`/dev/macfuse0` or the `vfs.generic.macfuse.version.number` sysctl), and did the last `load_macfuse` fail. "Present + not loaded after a load attempt" is the practical "needs approval" proxy (D31).

## 7. Uninstall and coexistence with kbfuse

- **Stock uninstall:** download the current DMG from macfuse.io and run the **Uninstaller app in its `Extras` folder** (WIKI `Frequently-Asked-Questions`). Homebrew uninstalls via the two launchd labels and two pkg receipts in §2. We never uninstall stock macFUSE.
- **Coexistence on disk:** no shared paths or IDs.

| | kbfuse (legacy) | stock macFUSE |
|---|---|---|
| fs bundle | `/Library/Filesystems/kbfuse.fs` | `/Library/Filesystems/macfuse.fs` |
| fs bundle ID | `com.github.kbfuse.filesystems.fs.kbfuse` | `io.macfuse.filesystems.fs.macfuse` |
| kext ID | `com.github.kbfuse.filesystems.kbfuse` | `io.macfuse.filesystems.macfuse` |
| helpers | `mount_kbfuse`, `load_kbfuse` | `mount_macfuse`, `load_macfuse` |
| device | `/dev/kbfuseN` | `/dev/macfuseN` |
| sysctl | `vfs.generic.kbfuse.*` | `vfs.generic.macfuse.*` |
| fstype | `kbfuse` | `macfuse` |
| Team ID | Keybase | `3T5GSNBU6W` |

  The kbfuse names come from KBB `Info.plist` files, `go/install/fuse_status_darwin.go:22,36` and `mounter_osx.go:27–32`. kbfuse was renamed precisely so that it could live alongside osxfuse/macFUSE, and `mounter_osx.go:65–68` already tried both locations in tests. Two FUSE kexts loaded at once on macOS 12–26 has not been tested here: **UNVERIFIED**, but expected to work given the distinct names. The D29 migration removes kbfuse anyway.

## 8. keybase/fuse fork vs stock macFUSE 5

| FORK site | Value | Matches stock? |
|---|---|---|
| `options.go:281–286` `OSXFUSELocationV4` | `/dev/macfuse`, `…/macfuse.fs/Contents/Resources/load_macfuse`, `…/mount_macfuse`, `_FUSE_DAEMON_PATH` | **Yes**: LIB `fuse_darwin.h` L19, `mount_darwin.c` L476 |
| `mount_darwin.go:273–278` | default locations are **V3 and V2 only** | V4 must be passed explicitly: `fuse.OSXFUSELocations(fuse.OSXFUSELocationV4)`. (`go/kbfs/redirector/main.go:31-36` also has kbfuse paths; D25 drops the redirector on macOS, so it is not ported) |
| `mount_darwin.go:30–38` | loads when `<prefix>0` is missing | `/dev/macfuse0`: yes |
| `mount_darwin.go:159–164,187` | `_FUSE_CALL_BY_LIB`, `_FUSE_COMMFD` | yes (LIB L672, L480) |
| (none) | `_FUSE_COMMVERS` not sent | stock libfuse sends `2`. See §4 (**SPIKE** for 5.4) |
| `mount_darwin.go:146–156` | always passes `iosize=` | documented option, yes |
| `fuse_kernel.go:46–49` | FUSE protocol min **7.8**, max **7.12**. Answers with `min(kernel, 7.12)` (`fuse.go:218–233`) | stock libfuse2 header is **7.19** (LIB `include/fuse_kernel.h` L119, L122). The kext's own supported range is **SPIKE** (closed). It must accept ≤7.12 because kbfuse 5.0.6 (same kext code) works with this fork today. The 5.4.0 notes "Harden notification handling by validating protocol versions" — the fork sends `InvalidateNode`/`InvalidateEntry` notifications (`fuse.go:1159,1181`, used by `libfuse/dir.go:227`), so check during the D20 spike that cache invalidation still works on 5.4.0 |

## 9. License and download link

Clause 4 of `https://github.com/macfuse/macfuse/blob/release/macfuse/LICENSE.txt` (Copyright (c) 2011-2026 Benjamin Fleischer), verbatim:

> 4. Redistributions in binary form, bundled with commercial software, are not
>    allowed without specific prior written permission. This includes the
>    automated download or installation or both of the binary form in the
>    context of commercial software.

User-facing download link: **https://macfuse.io**. It is the link the wiki gives ("Download the latest version of macFUSE from https://macfuse.io or https://github.com/macfuse/macfuse/releases"), and it currently 302s to `https://macfuse.github.io/`. A stable alternative is `https://github.com/macfuse/macfuse/releases/latest`, which redirects to the newest tag (today `macfuse-5.4.0`). Do not link versioned `.dmg` URLs (D9: link only, never download).

## SPIKE and UNVERIFIED summary

The spike (`01-mounter.md`) answers these. Results go in `README.md` § Spike results.

1. **SPIKE:** does `mount_macfuse` create a missing `/Volumes/Keybase (<user>)` (and remove it on unmount)? Settles D30.
2. **SPIKE:** exact `mount` / `f_fstypename` string on a live stock mount (expected `macfuse`).
3. **SPIKE:** whether stock `load_macfuse` is setuid root, and its exit code and stderr when the kext is not approved (D31).
4. **SPIKE:** whether `mount_macfuse` 5.4.0 still supports the version-1 comm protocol (no `_FUSE_COMMVERS`) that the fork uses.
5. **SPIKE:** the FUSE protocol range of the 5.4.0 kext, and whether its stricter notification validation accepts the fork's 7.12 notifications.

Not answerable from here:

6. **UNVERIFIED:** `Extensions/<N>` directory set in 5.4.0 (whether a `27` exists, and which are real vs. symlinks).
7. **UNVERIFIED:** where the 5.x launchservice broker/daemon binaries live.
8. **UNVERIFIED:** kbfuse and stock macFUSE kexts loaded at the same time (only matters on an upgraded machine before the D29 run succeeds).
