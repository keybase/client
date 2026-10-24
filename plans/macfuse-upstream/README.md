# macFUSE upstream — resume here

## Goal

Stop shipping Keybase's white-labeled kbfuse driver on macOS. Users who want KBFS in Finder install stock macFUSE 5.x (kext mode) from https://macfuse.io themselves; the app only links there and tells them how to allow the kext. KBFS and the in-app Files tab keep working without it. The `/keybase` redirector and the root helper go away: nothing can install the helper any more, and upgraders' helper, kbfuse and old redirector/mount directories are removed once, using methods the installed helper 1.0.47 already has (D1, D6, D7, D25, D29, D38, D40, D41, D46). When the updater cannot rename the app, it swaps the bundle's `Contents` in place as the user, as the old helper-era path did, now in Go (D49), and shows a one-time admin prompt only if that fails (D45).

- Worktree: `$GOPATH/src/github.com/keybase/client-macfuse`
- Branch: `nojima/macfuse-upstream` (off `master`, base `6b06505404`)

## Status

| Layer | Spec | Status |
|---|---|---|
| 00 | [00-macfuse-facts.md](00-macfuse-facts.md) | ✓ reference (no code) |
| 01 | [01-mounter.md](01-mounter.md) — mount on stock macFUSE, drop darwin redirector, mount point; **spike gate** | not started |
| 02 | [02-install-status-cli.md](02-install-status-cli.md) — status, install, CLI, D27 marker, D28 CLI prompt shared with the updater's rename fallback (D49 unprivileged `Contents` swap first, D45 prompt only if it fails), D29 retirement, no `app` component (D38) | not started |
| 03 | [03-osx-packaging.md](03-osx-packaging.md) — delete kbfuse and every helper install path (D38), `--retire-helper` with D40 and every-account D41/D46 cleanup, stale KBKit project refs, `Fuse.icns` and its credit removed (D48), helper copy kept (D47), release gate | not started |
| 04 | [04-ui.md](04-ui.md) — macFUSE states, approval help, Settings switch with no off-confirm (D43), "Install command line tool" button (D39) | not started |
| 05 | [05-docs-audit.md](05-docs-audit.md) — docs, `CHANGELOG.txt` entry (D44), grep gate | not started |

Later, separate effort: [fskit-future.md](fskit-future.md) (our own FSKit module, D8).

Decisions: [decisions.md](decisions.md) is authoritative and append-only. D25–D37 supersede parts of D11, D12, D14–D16 and D20. D38–D44 answer the owner questions the reconciled specs raised; D45–D47 answer the next three (updater fallback, other accounts' mount dirs, bundled helper copy). D48 allows `.pbxproj` edits except the bundled helper copy, and D49 corrects D45: the updater tries the unprivileged `Contents` swap before any prompt. D50 puts the Keybase Homebrew cask out of scope.

## Next step

Run the spike in `01-mounter.md`:

1. **Owner:** install macFUSE 5.4 from https://macfuse.io and approve its kernel extension (Apple silicon: the one-time Reduced Security step in Recovery, then **Allow** in Privacy & Security, then restart). Tell the agent when done.
2. **Agent:** follow `01-mounter.md` § How to verify, starting with **Check 0** (does `mount_macfuse` create a missing `/Volumes/Keybase (<user>)`?). Stop the installed KBFS first; ask before anything that touches the Electron app or Finder (D19).
3. Fill in § Spike results below and the 01 Log in one spec-only commit (D23). If D20 items 1–3 fail, stop and report; do not start 02 (D3, D20).

## Prerequisites and gates

- **Spike gate (D20, D37):** KBFS mounts at the D30 mount point; shell ops, Finder and Quick Look work. Items 4–6 (100 MB copy, clean unmount, sleep/wake) are logged, not blocking.
- **Mount point (D30):** decided by spike Check 0 — `/Volumes/Keybase (<user>)` if `mount_macfuse` creates it, otherwise `~/Keybase` plus a Finder sidebar entry. 01–04 each have a branch for both.
- **Release gate (D33):** merging waits for a rebuilt, signed and notarized `KeybaseInstaller` 1.1.95 without kbfuse and with `--retire-helper` (03 § Release gate). Until then the branch works, but upgraders' migration fails softly and retries every launch.

## Rules for working

- Layer order 01 → 02 → 03 → 04 → 05 (D21). No PR and no push until the owner asks.
- Specs are checked in on this branch (D22) and kept current: every code commit updates its layer spec (Status, Log) and this README in the same commit (D23). A decision change gets a new D entry in `decisions.md`, never an edit of an old one.
- Verify before stating a fact (D24): every file:line in a spec is checked against the branch when written; anything unchecked is **UNVERIFIED**; anything the spike must answer is **SPIKE**.
- Validation:
  - TS (from `shared/`): `yarn lint:all` (0 bailouts, 0 whole-props deps) and `yarn test:unit`.
  - Go (from `go/`): `gofmt -l` empty and `golangci-lint run --new-from-rev master` clean, plus each layer's `go test`/`go vet`, including `GOOS=linux` and `GOOS=windows` builds.
  - ObjC: see 03 § How to verify (unsigned compile; signed checks need the release machine).
  - `/code-review high` only right before a push or PR, after both validations pass.
- Never touch the Electron app, Finder or the iOS simulator without asking; the owner drives and takes screenshots (D19). The dev service may be started and stopped freely.
- Never hand-edit generated code (`rpc-gen.tsx`, `go/protocol`, `KBRPC.{h,m}`). This effort plans no avdl change.
- Temp files and spike builds go in `/tmp/` (`/tmp/macfuse-spike`).

## How to resume

1. Read this README.
2. Read `decisions.md` in full (D1–D50; D25 onward change a lot).
3. Read the spec of the first layer whose status is not ✓, then its Log.
4. Check the worktree: `git -C $GOPATH/src/github.com/keybase/client-macfuse status` and `git log --oneline master..`.

## Owner questions still open

Collected from the specs' Risks sections (not spike questions). Each spec states the default it assumes until answered.

- None. (The updater-fallback question is answered by D49.)

## Follow-ups after ship (not on this branch)

- **D42:** one or two releases after this ships, delete `osx/Helper/` and stop bundling the helper in `KeybaseInstaller`: the Copy Files phase (`osx/Keybase.xcodeproj/project.pbxproj:88-96`, build file `:25`, Installer phase list `:585`), the `keybase.Helper` target (`:522-538`) with its other project references, and `osx/Podfile:30`, all kept on this branch by D47. (`Fuse.icns`, its credit and the stale KBKit project references are removed on this branch, D48.) Nothing will be left that can talk to an installed helper, so decide then what happens to `--retire-helper` and Go's `retireLegacyHelper` for anyone who still has not upgraded.
- **D26:** drop `kbfuse` from the KBFS fstype list once the legacy removal has had time to run.

## Spike results

Fill in from `01-mounter.md` § How to verify. Leave a cell as "—" until answered.

| # | Question | Answer | Source / log |
|---|---|---|---|
| S1 | (D37) Does `mount_macfuse` create a missing `/Volumes/Keybase (<user>)`? Removed on unmount? → D30 outcome | — | — |
| S2 | Live fstype and mntfrom strings for the KBFS mount (D26) | — | — |
| S3 | Is `load_macfuse` setuid? Output and exit code when the kext is not approved (D31) | — | — |
| S4 | Mount handshake without `_FUSE_COMMVERS` works on 5.4? | — | — |
| S5 | FUSE 7.12 INIT accepted by the 5.4 kext? | — | — |
| S6 | `iosize=` and `excl_create` accepted? | — | — |
| S7 | Cache invalidation (`InvalidateNode`/`InvalidateEntry`) works on 5.4? | — | — |
| D20.1 | Mounts at the D30 mount point | — | — |
| D20.2 | Shell ops in `private/<me>`, public folder read | — | — |
| D20.3 | Finder browse + Quick Look | — | — |
| D20.4 | 100 MB in/out, throughput | — | — |
| D20.5 | Clean unmount on quit/logout | — | — |
| D20.6 | Survives sleep/wake | — | — |
