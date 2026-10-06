# macFUSE upstream — resume here

## Goal

Stop shipping Keybase's white-labeled kbfuse driver on macOS. Users who want KBFS in Finder install stock macFUSE 5.x (kext mode) from https://macfuse.io themselves; the app only links there and tells them how to allow the kext. KBFS and the in-app Files tab keep working without it. The `/keybase` redirector and the root helper go away: new installs get no helper, and upgraders' helper and kbfuse are removed once, using methods the installed helper 1.0.47 already has (D1, D6, D7, D25, D29).

- Worktree: `$GOPATH/src/github.com/keybase/client-macfuse`
- Branch: `nojima/macfuse-upstream` (off `master`, base `6b06505404`)

## Status

| Layer | Spec | Status |
|---|---|---|
| 00 | [00-macfuse-facts.md](00-macfuse-facts.md) | ✓ reference (no code) |
| 01 | [01-mounter.md](01-mounter.md) — mount on stock macFUSE, drop darwin redirector, mount point; **spike gate** | not started |
| 02 | [02-install-status-cli.md](02-install-status-cli.md) — status, install, CLI, D27 marker, D28 CLI prompt, D29 retirement | not started |
| 03 | [03-osx-packaging.md](03-osx-packaging.md) — delete kbfuse, no helper on new installs, `--retire-helper`, release gate | not started |
| 04 | [04-ui.md](04-ui.md) — macFUSE states, approval help, Settings switch | not started |
| 05 | [05-docs-audit.md](05-docs-audit.md) — docs and grep gate | not started |

Later, separate effort: [fskit-future.md](fskit-future.md) (our own FSKit module, D8).

Decisions: [decisions.md](decisions.md) is authoritative and append-only. D25–D37 supersede parts of D11, D12, D14–D16 and D20.

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
2. Read `decisions.md` in full (D25–D37 change a lot).
3. Read the spec of the first layer whose status is not ✓, then its Log.
4. Check the worktree: `git -C $GOPATH/src/github.com/keybase/client-macfuse status` and `git log --oneline master..`.

## Owner questions still open

Collected from the specs' Risks sections (not spike questions):

- `keybase install --components=app` still blesses the helper. Keep it, or drop the app component on macOS? (02, 03)
- Add a visible "Install command line tool" button, or is the existing first-run prompt enough for D28? (02)
- Should the D29 run also stop and remove `/Volumes/Keybase` (the old redirector's fallback mount)? (03)
- Under the `~/Keybase` fallback, should the D29 run also remove the old `/Volumes/Keybase (<user>)` dir? (03)
- When to delete `osx/Helper/` and stop bundling the helper. (03)
- Drop the darwin "Remove & Restart" confirm dialog when turning Finder off, or keep a lighter one? (04)
- Where user-facing release notes live. (05)

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
