# Decisions log

Append-only. A changed decision gets a new entry that names the one it supersedes; never rewrite an old entry.

Settled in the 2026-10-06 grilling session.

## Scope and goal

- **D1 — Goal.** Stop shipping Keybase's white-labeled macFUSE ("kbfuse"). Users who want KBFS mounted on disk install stock macFUSE themselves; the app tells them how.
- **D2 — Branch.** `nojima/macfuse-upstream` off `master`, worktree at `$GOPATH/src/github.com/keybase/client-macfuse`.
- **D3 — Deliverable.** A shippable branch, built in layers. Prove the mount works on stock macFUSE first; if it does not, stop before the later layers.
- **D4 — Platform.** macOS only. Windows (Dokan) and Linux (system FUSE) are untouched.
- **D5 — One driver.** Stock macFUSE is the only supported driver. kbfuse code paths are deleted, except the one-time removal of legacy installs (D11).
- **D6 — Mounting is opt-in.** KBFS and the in-app Files tab work fully without macFUSE. The install link appears only when the user asks for Finder or on-disk access. The app never nags otherwise.

## Driver choice

- **D7 — Kext mode, not FSKit.** Use stock macFUSE in its default kernel-extension mode. The `keybase/fuse` fork already supports it (`OSXFUSELocationV4`: `/dev/macfuse`, `mount_macfuse`, `load_macfuse`).
  - **Why:** If users install macFUSE anyway, its FSKit mode would only add cgo against `MFMount.framework`, FSKit's network-filesystem gaps, and worse performance, just to skip the Recovery Mode step. Apple Silicon users already go through Recovery Mode for kbfuse today, so the user experience does not get worse.
  - **Supersedes** the provisional "FSKit only" answers given earlier in the same session (old Q14–Q17, Q20).
- **D8 — FSKit later, on its own.** Phase (b) is our own FSKit module: a Swift extension in the Keybase app, macOS 26+, nothing for the user to install. It is a separate branch and effort. See `fskit-future.md`.
  - **Why:** FSKit is only worth it if we own it and the user installs nothing.
- **D9 — License posture.** The app only links to https://macfuse.io. It never downloads, installs, or runs `brew` for macFUSE.
  - **Why:** macFUSE's license clause 4 forbids commercial bundling *and* "automated download or installation" without written permission. Whether to also ask the macFUSE author is the owner's call, outside this branch.
- **D10 — Minimum macFUSE version is 5.x.** Read the installed version from `macfuse.fs`'s `Info.plist`. Below 5.0 counts as "needs update" and shows the same link. The minimum macOS version follows macFUSE 5's own minimum (see `00-macfuse-facts.md`).

## Migration, packaging, CLI

- **D11 — Remove legacy kbfuse automatically.** The upgrade's installer run removes `/Library/Filesystems/kbfuse.fs` and unloads its kext. That run already has the privileged helper's admin rights, and the helper already has `kextUninstall`. If removal fails because something is still mounted (installer exit code 7), retry on the next launch.
- **D12 — Change the `osx/` sources on this branch.** Delete `osx/Fuse/` and the kbfuse parts of `KBFuseComponent`, `osx/Scripts/build.sh`, and `versions.sh`. Rebuilding and signing `KeybaseInstaller.app` is a release step, documented rather than done here. The helper keeps `kextUnload`/`kextUninstall` until the migration window has passed.
- **D13 — Remove the closed-source consent checkbox** (`useFuseClosedSourceConsent`). The user accepts macFUSE's license in macFUSE's own installer.
- **D14 — CLI behavior.**
  - `keybase install --components=fuse` prints "install macFUSE from https://macfuse.io" and exits non-zero.
  - `keybase uninstall --components=fuse` removes legacy kbfuse.
  - The `--use-system-fuse` flag is deleted.
  - `keybase fuse status` reports the stock macFUSE install.

## Mount layout

- **D15 — Keep the `/keybase` redirector**, mounted on stock macFUSE through the kext. Earlier in the session, FSKit (which only mounts under `/Volumes`) had forced dropping it; under D7 it stays.
- **D16 — Keep the privileged helper** (`keybase.Helper`). It still runs the redirector and does the D11 kbfuse removal.

## UI

- **D17 — The Finder toggle has three states.**
  - **Not installed:** the toggle is disabled, with "Install macFUSE" and a link.
  - **Outdated:** the toggle is disabled, with "Update macFUSE" and a link.
  - **Ready:** turning it on mounts KBFS and turning it off unmounts it, with no admin prompt.
  
  The fs banner and the "Show in Finder" action follow the same states.
- **D18 — Kext-approval state.** When macFUSE is installed but its kext is not allowed, show a reworded help state for macFUSE with Recovery Mode steps on Apple Silicon. It replaces the kbfuse-specific kext-permission popup text.

## Process

- **D19 — Validating it works.**
  - The owner installs macFUSE and approves its kext.
  - The agent builds the service from the worktree and runs it in place of the installed one.
  - The agent may start and stop the dev service freely.
  - The Electron app is touched only after asking.
- **D20 — When the mount counts as working** (the spike gate):
  1. KBFS mounts at `/Volumes/Keybase (<user>)`, and `/keybase` redirects to it.
  2. From the shell: `ls`, `cat`, write, rename, and delete in `private/<me>`, and reading a public folder.
  3. Finder browses it and Quick Look works.
  4. Copying a ~100 MB file in and out finishes with no errors, and the throughput is recorded.
  5. Quitting or logging out of the app unmounts cleanly.
  6. The mount survives sleep and wake.
  
  Failing 1–3 means stop and report. Failing 4–6 means note it and continue.
- **D21 — Layer order:** `01-mounter` → `02-install-status-cli` → `03-osx-packaging` → `04-ui` → `05-docs-audit`. No PR and no push until the owner asks.
- **D22 — Specs are checked in on the branch** under `plans/macfuse-upstream/` and deleted once the work is validated. This is an explicit exception to the repo's "never commit plan docs" rule, for this effort only.
- **D23 — Keep the specs current.** Each commit that changes code updates the matching layer spec and `README.md` in the same commit. A spec-only commit is fine when a decision changes.
- **D24 — Verify before stating a fact.** Every file and line reference in a spec is checked against the branch when written. Anything that could not be checked is marked **UNVERIFIED**.

## Second round (2026-10-06, after the layer specs were drafted)

- **D25 — Drop the `/keybase` redirector and the root helper.**
  - **Supersedes:** D15 and D16. The helper's PATH role moves to D28 and its cleanup role to D29.
  - **Effect:** `/keybase/...` stops working on macOS. New installs get no helper.
  - **Why:** Once no kext is installed, the redirector is the only remaining reason to keep a root helper. The helper's `remove` method also lets any process running as a staff user delete any file as root.
- **D26 — Mount by its filesystem type.** The mount check (`go/mounter`, the status code) treats both `macfuse` and `kbfuse` as KBFS mounts until the legacy removal has run, so leftover kbfuse mounts can be found and unmounted. Later, only `macfuse`.
- **D27 — Remember the user's choice.** A per-user file, `<configDir>/kbfs_finder_enabled`, means "the user wants KBFS mounted".
  - Turning Finder access on (the `installKBFS` RPC) sets it; turning it off (`uninstallKBFS`) clears it.
  - It is set automatically for upgraders who had kbfuse.
  - `install-auto` mounts KBFS only when the file exists *and* macFUSE is ready (D6).
- **D28 — CLI on PATH.** For new installs, an "Install command line tool" action runs a one-time admin prompt (`osascript … with administrator privileges`) that creates the `/usr/local/bin/keybase` symlink. Upgraders keep their existing symlink. `keybase uninstall` removes it the same way.
- **D29 — Retiring the helper on upgrade.**
  - **Steps:** one last migration run, using only methods the helper 1.0.47 already has:
    1. `stopRedirector`
    2. `kextUnload` and `kextUninstall` for kbfuse
    3. `remove` `/keybase`
    4. `remove` the helper's own launchd plist and binary
  - **Result:** no new helper version, so no admin re-approval prompt. The helper process lingers until the next reboot.
  - **On failure:** retry on the next launch.
  - **Supersedes** D11's mechanism (the outcome is the same) and the part of D12 that keeps the helper's kext methods.
- **D30 — The mount point.** Use `/Volumes/Keybase (<user>)` if the spike shows `mount_macfuse` creates the missing directory itself; `/Volumes` is `root:wheel 755`. Otherwise mount at `~/Keybase`, owned by the user, and add it to the Finder sidebar.
- **D31 — How "kext not approved" is detected.**
  - The UI's enable still calls `installFuse`. It no longer installs anything: it checks that macFUSE is installed and at least 5.x, then tries `load_macfuse`.
  - If the load fails, it returns installer exit code 5. The UI keeps that path and shows the D18 macFUSE approval help.
  - Then the UI calls `installKBFS`.
  - The spike records what `load_macfuse` actually prints and returns when the kext is not approved.
- **D32 — Amends D14.** `keybase install --components=fuse` exits 0 when macFUSE is installed and ready. It exits non-zero with the macfuse.io message when macFUSE is missing or outdated.
- **D33 — Release gate.** Merging waits for a rebuilt, signed, and notarized `KeybaseInstaller` 1.1.95 without kbfuse. Until then, any non-zero exit from removing kbfuse means "retry next launch".
- **D34 — Finder auto-open.** Opening Finder on a change from Disabled to Enabled stays as it is today, including mounts started from the CLI.
- **D35 — Kext approval steps.** Show only the steps for the user's architecture. Pass `process.arch` through the existing constants.
- **D36 — Settings control.** On macOS, Settings → Files uses a `Kb.Switch`. Windows keeps its buttons.
- **D37 — Amends D20 item 1.** The spike gate is: KBFS mounts at the D30 mount point. The `/keybase` part is dropped under D25. A new first check: does `mount_macfuse` create a missing `/Volumes/Keybase (<user>)`? Its answer settles D30.

## Third round (2026-10-06, open questions raised by the reconciled specs)

- **D38 — Drop the `app` install component on macOS.**
  - `keybase install --components=app` no longer installs the helper.
  - The helper install path in KBKit is deleted now, along with installer exit codes 6 and 8 and error -303.
- **D39 — A visible CLI install action.** Settings gets an "Install command line tool" button that runs the D28 one-time admin prompt. The existing first-run prompt stays.
- **D40 — Clean up any old redirector at `/Volumes/Keybase`.** If the old redirector had fallen back to `/Volumes/Keybase`, the D29 retirement also stops it and removes that directory. This uses the same existing helper methods.
- **D41 — Remove the old per-user mount directory.** If D30 falls back to `~/Keybase`, the D29 retirement also removes the old `/Volumes/Keybase (<user>)` directory with the helper's `remove`. The user cannot do that without root.
- **D42 — When to delete `osx/Helper/`.** It is deleted, and the helper stops being bundled, one or two releases after this ships. This is tracked in the README; it does not happen on this branch.
- **D43 — No confirmation when turning Finder access off.** Turning it off just unmounts, so the macOS "Remove & Restart" dialog goes away with no replacement.
- **D44 — Release notes.** User-facing notes go in `shared/desktop/CHANGELOG.txt` (the bulleted lines starting with `•`). Layer 05 adds the entry: macFUSE is now installed by the user from macfuse.io, and `/keybase` is gone on macOS.

## Fourth round (2026-10-06)

- **D45 — An admin prompt replaces the updater fallback.**
  - **When:** the updater cannot rename `/Applications/Keybase.app`.
  - **What:** a one-time admin prompt (`osascript … with administrator privileges`) replaces the deleted `install --components=app` fallback. It shares code with D28.
  - **Why:** silently losing auto-update for some users is worse than a rare prompt.
- **D46 — Retirement cleans up every user's mount folder.** The D29 retirement removes every `/Volumes/Keybase (*)` directory that is not currently a mount point, not just the folder of the user who happens to launch first.
  - **Why:** once the helper is gone, nobody can remove the others without root.
  - Before each removal, check the mount table (03's safety guard).
  - **Supersedes** D41's single-user scope.
- **D47 — Keep the bundled helper copy until D42.** The installer keeps shipping its bundled helper copy until the D42 cleanup. The retirement talks to the already-installed helper, so dropping the copy now gains nothing, and keeping it keeps `.pbxproj` edits off this branch.
- **D48 — Project-file edits are allowed on this branch (narrows D47).**
  - **Allowed:** `.pbxproj` edits, e.g. removing `Fuse.icns` and its credit, and KBKit project references to deleted files.
  - **Unchanged:** D47 still holds for the bundled helper copy. Its Copy Files phase, target and Podfile line stay until D42.
- **D49 — Corrects D45: try the old unprivileged swap first.**
  - **When:** renaming `/Applications/Keybase.app` fails.
  - **First:** the updater does what the old `KBAppBundle` path did, as the user: verify the signature, then swap `Keybase.app/Contents` in place. This now lives in Go next to the updater.
  - **Only if that also fails:** show the D28/D45 one-time admin prompt.
  - **Why:** the old fallback never ran as root; it went through the helper only because the `app` component required it. Users who update today with no prompt must keep doing so.

## Fifth round (2026-10-06)

- **D50 — The Keybase Homebrew cask is out of scope.** Keybase is no longer distributed through Homebrew, so no layer plans for a Homebrew-installed Keybase.
  - **Leave alone:** the `homebrew.mxcl.*` service labels and brew-prefix lookups in `go/install/install_darwin.go`, `go/client/cmd_install_osx.go` and `cmd_launchd_osx.go`; KBKit's "Homebrew Install Found" view (`KBAppView.m`); `packaging/brew/`. No spec adds work for them, and no layer is blocked on them.
  - The macFUSE Homebrew cask references in `00-macfuse-facts.md` are third-party reference only and stay.
