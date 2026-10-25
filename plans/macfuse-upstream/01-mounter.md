# 01 — Mounter

Status: [ ] not started

## Goal

Make KBFS (`kbfs`, built from `go/kbfs/kbfsfuse`) mount through stock macFUSE 5.x in kext mode (D7) instead of kbfuse, at the D30 mount point, with no root helper and no `/keybase` redirector on macOS (D25). Make the Go code that recognizes a KBFS mount accept `macfuse` and legacy `kbfuse` (D26).

This layer is also the spike gate (D20 as amended by D37). Its first check settles the mount point (D30). If D20 items 1–3 fail, stop and report before layer 02.

## Depends on

- `decisions.md`: D5, D7, D14, D19, D20, D25, D26, D30, D37.
- `00-macfuse-facts.md` for every stock macFUSE fact: bundle path, `/dev/macfuse*`, `load_macfuse` and `mount_macfuse` paths, fstype, kext bundle ID, and the `/Volumes` permissions (§2 "Mount point under `/Volumes`").
- The owner has installed macFUSE 5.x from https://macfuse.io and approved its kext (D19).

## Current state (verified 2026-10-06 against branch `nojima/macfuse-upstream` @ 6b06505404)

- `go/go.mod:198` maps `bazil.org/fuse` to `github.com/keybase/fuse v0.0.0-20210104232444-d36009698767`. In that module:
  - `options.go:281-286` already defines `OSXFUSELocationV4` as `/dev/macfuse`, `.../macfuse.fs/Contents/Resources/{load,mount}_macfuse`, with `DaemonVar` `_FUSE_DAEMON_PATH`.
  - `mount_darwin.go:272-296` (`mount`) skips any location whose `Mount` binary is missing. It runs `Load` only if `<DevicePrefix>0` does not exist (`:30-38`), then calls `callMount`.
  - `callMount` (`mount_darwin.go:138-270`) execs the helper with `-o <opts> -o iosize=<maxWrite> <dir>`. It sets `MOUNT_FUSEFS_CALL_BY_LIB`, `MOUNT_OSXFUSE_CALL_BY_LIB` and `_FUSE_CALL_BY_LIB`, plus `DaemonVar=os.Args[0]` and `_FUSE_COMMFD=<fd>` (`:187`), then receives the `/dev` fd over `SCM_RIGHTS` (`:103-136`). It does not set `_FUSE_COMMVERS`.
  - FUSE protocol support is 7.8 to 7.12 (`fuse_kernel.go:46-49`).
- `go/kbfs/libfuse/mounter_osx.go`
  - `:27-32` defines `kbfusePath` (`/dev/kbfuse`, `load_kbfuse`, `mount_kbfuse`).
  - `:37-45` chooses `OSXFUSELocationV3` when `UseSystemFuse` is set, and `kbfusePath` otherwise.
  - `:53-58` sets `volname=<Keybase (user)>` and `excl_create`, plus `local` if `UseLocal`. No `fsname` is set.
  - `:64-76`: the test options use `kbfusePath, OSXFUSELocationV3`.
  - `:78-90`: the `ErrOSXFUSENotFound` text mentions kbfuse, OSXFUSE 3.x and `--use-system-fuse`.
- `go/kbfs/libfuse/platform_flags_osx.go`: `:14` is the `UseSystemFuse` field, `:25` the usage string, `:33-34` the flag. `go/kbfs/README.md:112` documents it.
- `go/kbfs/libfuse/mounter.go:84-91`: `fuseMountDir` gets the platform options and calls `fuse.Mount`. `mounter_non_osx.go:28` has the matching `translatePlatformSpecificError(err, platformParams)`. After a failed force mount, `mounter.go:52-60` unmounts, calls `reinstallMountDirIfPossible` (darwin: `mounter_osx.go:92-97`, which execs `KeybaseInstaller --uninstall-mountdir` then `--install-mountdir`) and retries. `fuseMountDir` creates the mount dir itself only on Linux (`mounter.go:65-70`).
- `go/kbfs/redirector/` is shared with Linux: `go/client/cmd_ctl_nix.go` (`//go:build !darwin && !windows`) configures it, and `packaging/linux/systemd/keybase-redirector.service`, `packaging/linux/post_install.sh` and `run_keybase` ship it. So the package stays; only its darwin paths go (D4, D25).
  - `main.go:5` is `//go:build !windows`; `disable_dumpable.go:5` is `//go:build !linux && !windows`.
  - `main.go:31-36` holds a second `kbfusePath`; `:182-185` sets `fuseType = "kbfuse"` on darwin; `:370-376` adds the darwin mount options.
- Mount location in `go/libkb`:
  - `env.go:413-447` `GetMountDirDefault`: darwin returns `/Volumes/<Keybase|KeybaseStaging|KeybaseDevel> (<user>)`.
  - `util.go:1009-1018` `preferredKBFSMountDirs`: darwin returns `/keybase` and `/Volumes/Keybase` (both redirector paths). `FindPreferredKBFSMountDirs` (`:1020-1031`) keeps those whose `private` is a symlink.
  - `go/service/kbfs_mount.go:38-70` `WaitForMounts` loops until **both** the direct mount (`.kbfs_error` file) and a preferred dir are found (`:61`). With no redirector on darwin, the preferred check never passes, so it always times out after 10 s. `GetPreferredMountDirs` (`:72-80`) appends the direct mount dir.
- Today the mount dir under `/Volumes` is created as root by the helper (`osx/Helper/KBHelper.m:175-191,233-241`, called from `osx/KBKit/KBKit/Component/KBMountDir.m:100-117`). Under D25 nothing with root rights is left to create it (`/Volumes` is `root:wheel 755`, see 00).
- `go/mounter/mounter_osx.go:14-27`: `IsMounted` returns true only if the statfs `f_mntfromname` contains `"@kbfuse"`. Callers: `mounter.Unmount` (`mounter_nix.go`) and `install.unmount` (`go/install/install_darwin.go:937-962`).
- Layer 02 owns `go/install/fuse_status_darwin.go` and the install-time mount decision; layer 03 owns `osx/` and `packaging/`.
- The dev box (2026-10-06) has the legacy helper installed (`/Library/PrivilegedHelperTools/keybase.Helper`, `/Library/LaunchDaemons/keybase.Helper.plist`) but no `/Library/Filesystems/kbfuse.fs` and no `/keybase`.

## Changes

1. `go/kbfs/libfuse/mounter_osx.go`: delete `kbfusePath` (`:27-32`). In `getPlatformSpecificMountOptions`, replace the `UseSystemFuse` branch (`:37-45`) with `fuse.OSXFUSELocations(fuse.OSXFUSELocationV4)`. Keep `volname`, `excl_create` and `local` (D5, D7).
2. Same file, `GetPlatformSpecificMountOptionsForTest` (`:64-76`): use `OSXFUSELocationV4` only and drop the kbfuse/OSXFUSE TODO.
3. Same file, `translatePlatformSpecificError` (`:78-90`): return `errors.New("cannot locate macFUSE; install macFUSE 5 or later from https://macfuse.io")`. Keep the `platformParams` parameter only if `mounter_non_osx.go:28` still needs it to match; otherwise drop it from both files and the caller at `mounter.go:90`.
4. `go/kbfs/libfuse/platform_flags_osx.go`: delete `UseSystemFuse` (`:14`) and the flag (`:33-34`); usage string (`:25`) becomes `"[--local-experimental]\n    "` (D14). Remove the `--use-system-fuse` text at `go/kbfs/README.md:112`.
5. **Redirector off on darwin (D25).** Linux keeps it unchanged (D4).
   - `go/kbfs/redirector/main.go:5` → `//go:build !windows && !darwin`; `disable_dumpable.go:5` → `//go:build !linux && !windows && !darwin`.
   - Delete `kbfusePath` (`main.go:31-36`), the darwin `fuseType` override (`:183-185`) and the `case "darwin"` options (`:371-376`).
   - The build tag breaks the darwin prerelease build, so the same commit stops building and shipping it on darwin: `packaging/prerelease/build_kbfs.sh:36-37` builds it only when `PLATFORM=linux`, and `:44` (darwin codesign) goes; `packaging/desktop/package_darwin.sh:39,99,148-149,194,241` stop resolving, copying and verifying `keybase-redirector`; `packaging/prerelease/build_app.sh:126` drops `REDIRECTOR_BINPATH`. The darwin install, start and stop paths belong to 02; the KBKit redirector code to 03.
6. `go/mounter/mounter_osx.go:14-27`: return true when the statfs `Fstypename` is in `{"macfuse", "kbfuse"}` (D26), via a small `cstr(st.Fstypename[:])`. The `kbfuse` entry carries a comment tying it to the D29 migration; it is deleted once the migration window closes. Update the comments at `:14` and `mounter_non_osx.go:12`.
7. **Mount point (D30, gated on the spike's first check):**
   - **If `mount_macfuse` creates the missing directory:** `GetMountDirDefault` stays `/Volumes/Keybase (<user>)`. Layer 02 stops treating "mount dir does not exist" as "skip mount".
   - **Otherwise:** `env.go:413-447` darwin returns `filepath.Join(<home>, runmodeName)` (`~/Keybase`, `~/KeybaseStaging`, `~/KeybaseDevel`). kbfs creates it, user-owned (change 8), and layer 03 adds it to the Finder sidebar through the existing `KBMountDir` favorite code without the helper.
   - Either way, `util.go:1013-1014` darwin `preferredKBFSMountDirs` returns `[]string{}` (both entries were redirector paths, D25). Linux keeps `/keybase`.
   - `go/service/kbfs_mount.go:61`: treat the preferred check as satisfied when the platform has no preferred dirs, so `WaitForMounts` returns as soon as the direct mount appears. Add a pure helper and a unit test for that decision.
8. **No installer calls from kbfs (D25).** `go/kbfs/libfuse/mounter_osx.go:92-97` `reinstallMountDirIfPossible` runs `KeybaseInstaller --uninstall-mountdir` and `--install-mountdir` after a failed force mount (`mounter.go:55-60`). The installer's mountdir path requires the helper, so on a new install it would trigger the helper's admin prompt. Make the darwin version a no-op, like `mounter_non_osx.go:32`, and drop the `libnativeinstaller` import. Under the `~/Keybase` fallback, extend the Linux `os.MkdirAll` in `fuseMountDir` (`mounter.go:65-70`) to darwin, so kbfs creates its own mount point.
9. Fork: no change planned. `OSXFUSELocationV4` is enough on paper. If the spike fails at the helper handshake or INIT, the fix lands in `github.com/keybase/fuse` as its own commit and `go.mod:198` is bumped. Never edit the module cache.
10. Update this spec's Log, `README.md` § Spike results and the status table in the same commit (D22, D23).

## Acceptance criteria

- `grep -rnE 'kbfuse|OSXFUSELocationV3|UseSystemFuse|use-system-fuse' go/kbfs go/mounter go/libkb` matches only the D26 legacy `kbfuse` fstype entry in `go/mounter/mounter_osx.go`, with its D29 comment.
- `GOOS=darwin go build ./kbfs/redirector` reports that build constraints exclude all files; `GOOS=linux go build ./kbfs/redirector` succeeds.
- `GOOS=darwin GOARCH=arm64 go vet ./kbfs/libfuse/... ./mounter/... ./libkb/... ./service/...` is clean, as is `GOOS=linux`. `gofmt -l` is empty and `golangci-lint run --new-from-rev master` reports nothing new.
- The D20/D37 gate passes with the built binaries against the installed stock macFUSE: the D37 first check is answered and logged, items 1–3 pass, and items 4–6 are passed or logged.

## How to verify

This is the spike. Builds go into `/tmp/macfuse-spike`. Run from `go/` in the worktree (`$GOPATH/src/github.com/keybase/client-macfuse/go`):

```sh
mkdir -p /tmp/macfuse-spike
go build -tags production -o /tmp/macfuse-spike/kbfs ./kbfs/kbfsfuse
go build -tags production -o /tmp/macfuse-spike/keybase ./keybase
file /tmp/macfuse-spike/*   # expect Mach-O arm64
```

Preflight (facts in `00-macfuse-facts.md`):

```sh
ls /Library/Filesystems/                  # macfuse.fs present, kbfuse.fs absent
/usr/bin/defaults read /Library/Filesystems/macfuse.fs/Contents/Info.plist CFBundleVersion  # >= 5
ls -l /Library/Filesystems/macfuse.fs/Contents/Resources/   # record: is load_macfuse setuid?
kmutil showloaded | grep -i macfuse       # empty until first mount is fine
```

Stop the installed KBFS. Leave the installed service running (D19 allows swapping it, but this layer does not change it):

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/keybase.kbfs.plist
mount | grep -iE 'keybase|kbfuse|macfuse'  # expect nothing
```

**Check 0 (D37, settles D30): does `mount_macfuse` create a missing `/Volumes` mount point?**

```sh
MP="/Volumes/Keybase ($USER)"
ls -ld "$MP"   # if it exists (left by the legacy helper), the owner removes it: sudo rmdir "$MP"
KEYBASE_RUN_MODE=prod /tmp/macfuse-spike/kbfs -debug -log-to-file "$MP" &
sleep 5; mount | grep -i macfuse; ls -ld "$MP"   # record: mounted? who owns the dir?
kill %1; sleep 3; ls -ld "$MP"                   # record: is the dir removed on unmount?
```

- If it mounted: D30 = `/Volumes/Keybase (<user>)`. Continue with `MP` as is.
- If it failed with a missing-mountpoint error: D30 = `~/Keybase`. Set `MP="$HOME/Keybase"; mkdir -p "$MP"` and rerun the mount above.
- Record the answer, and the exact error if any, in `README.md` § Spike results and the Log below.

D20 checklist (D37 wording), with KBFS mounted at `$MP`:

```sh
KEYBASE_RUN_MODE=prod /tmp/macfuse-spike/kbfs -debug -log-to-file "$MP" &
# 1. mount
mount | grep -i "$MP"            # record exact fstype and mntfrom strings (D26)
ls "$MP" && ls "$MP/private"
# 2. shell ops
cd "$MP/private/$KB_ME" && echo spike > spike.txt && cat spike.txt && mv spike.txt spike2.txt && rm spike2.txt
ls "$MP/public/keybase"         # read a public folder
# 3. Finder + Quick Look: the owner does this (the agent asks first). Open "$MP" in Finder, space-bar a file.
qlmanage -p "$MP/private/$KB_ME/<some image>"   # shell proxy, if the owner prefers
# 4. 100 MB copy, record throughput
mkfile 100m /tmp/macfuse-spike/big && time cp /tmp/macfuse-spike/big "$MP/private/$KB_ME/" \
  && time cp "$MP/private/$KB_ME/big" /tmp/macfuse-spike/big.back && cmp /tmp/macfuse-spike/big /tmp/macfuse-spike/big.back
# 5. clean unmount
kill %1; sleep 3; mount | grep -i "$MP" || echo unmounted
# 6. sleep/wake (owner): pmset sleepnow, wake, then repeat step 1
```

Also record for the later layers:
- **Kext not approved (D31):** if the owner can reproduce it (before approval, or after a macFUSE update), run `/Library/Filesystems/macfuse.fs/Contents/Resources/load_macfuse; echo $?` and record stdout, stderr and the exit code. Also record the kbfs log line for a mount attempt in that state.
- **Cache invalidation (00 §8):** edit a file in `$MP` from the Keybase app or another device and check that `cat` shows the new content without remounting.

Afterwards restore the installed KBFS: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/keybase.kbfs.plist`.

Unit and build checks (from `go/`):
- `go test ./mounter/... ./service/ -run 'Mount' -count=1` runs without a mount.
- `go test ./kbfs/libfuse/...` and `./kbfs/test -tags fuse` mount real volumes. Run them only after the manual gate passes, and log the result.
- `GOOS=linux go build ./kbfs/redirector ./client/... ./libkb/...`.

## Risks / open questions

- **SPIKE (D37):** does `mount_macfuse` create a missing `/Volumes/Keybase (<user>)`, and does it remove it on unmount? Settles D30 and change 7.
- **SPIKE:** the exact fstype string on a live stock mount (expected `macfuse`, D26).
- **SPIKE:** does the macFUSE 5.4 kext accept a daemon that negotiates FUSE 7.12 at INIT (`fuse_kernel.go:49`)? If the mount appears but the first `ls` hangs or gets `ENODEV`, INIT failed; capture `log show --last 5m --predicate 'sender CONTAINS "macfuse"'`.
- **SPIKE:** does `mount_macfuse` 5.4 still accept the `_FUSE_COMMFD` handshake without `_FUSE_COMMVERS`? A "receiving device FD error" or a mount helper exit status in the kbfs log points here; compare with macFUSE's open-source `lib/mount_darwin.c`.
- **SPIKE (D31):** what `load_macfuse` prints and returns when the kext is not approved, and whether it is setuid (needed for the user-run load in 02).
- **SPIKE:** are `iosize=<maxWrite>` and `excl_create` still accepted? An unknown option makes the mount helper fail loudly.
- **SPIKE:** does cache invalidation (`InvalidateNode`/`InvalidateEntry`) still work against the 5.4 kext's stricter notification checks (00 §8)?
- **Risk:** under the `~/Keybase` fallback the mount point is an ordinary home directory. Spotlight and Time Machine may try to index it. `KBMountDir` excluded the old dir from backup (`KBMountDir.m:91-96`); change 8 should do the same for `~/Keybase` (`tmutil addexclusion`, or 03's `KBMountDir` path, which already does it). **UNVERIFIED** whether Spotlight indexes a non-local FUSE volume under `$HOME`.

## Log

| date | commit | note |
|------|--------|------|
