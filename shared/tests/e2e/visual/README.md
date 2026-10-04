# Visual gate

Pixel-exact screenshots of read-only screens, compared between a base commit and your working
tree. Use it to prove a layout refactor changes nothing on screen, or to see exactly what it
changes. The compare is exact RGBA with no threshold; a size mismatch is a failure.

Platforms: Electron light and dark (1280x800 @2x), and iOS light on the `iPhoneTest` simulator
(`KB_IOS_DEVICE` overrides). The tour of screens is `tour.ts`: 40 desktop entries and 29 phone
entries, all signed in as the e2e smoke account.

## Before you start

- Desktop: the dev app running from this tree with the visual switches:
  `node tests/e2e/electron/launch-app.mts --visual` (from `shared/`).
- iOS: Metro from this tree (`yarn rn:start`) and the dev app on the simulator, logged in. The
  drivers start and stop Appium themselves.
- Env: `KB_SMOKE_USER`, `KB_SECOND_USER` and `KB_E2E_TEAM` (the seal reads through the `keybase` CLI).

## Commands

All from `shared/`. Add `--ios` for the phone; iOS is light only.

| Command | What it does |
|---|---|
| `yarn visual:base [ids…] --base <ref>` | Captures the base: serves the app from a checkout of `<ref>`, captures, then puts the app back on this tree. `--themes light,dark`, `--coverage` |
| `yarn visual:check <id\|glob>…` | Captures the named entries from this tree and compares them with the base. `--theme t` |
| `yarn visual:gate` | `check` over every entry, between two full seals |
| `yarn visual:aa` | Captures every entry twice, twice over (fresh prepare per round), and compares each pair. Run it after changing the tour or drivers |
| `yarn visual:coverage <range>` | Lists changed Box2 / ClickableBox call sites in `<range>` that no base capture mounted |
| `yarn visual:routes` | Lists every route, for checking what the tour leaves out |
| `yarn visual:unit` | The gate's own unit tests |

Ids are like `settings/display` or `team/members`; globs use `*` (`'settings/*'`).

Typical loop for a refactor:

```sh
git commit …                                   # the commit before your layout change
yarn visual:base --base HEAD && yarn visual:base --base HEAD --ios
# …make the change in the working tree…
yarn visual:check 'settings/*'                 # fast, scoped
yarn visual:gate && yarn visual:gate --ios     # everything
```

`check` prints one line per capture: `✓ id platform theme 0 px`, or
`✗ id platform theme N px in WxH at (x,y) → <diff.png>`, `unstable`, or `failed: …`. Any
non-`✓` line exits 1 and opens the HTML report (base/change slider, diff overlay, hatched masks).
Results live in `tests/results/visual/` (gitignored): `base/<sha>/<platform>/…` and `runs/<stamp>/`.

## The base must contain the gate

The base is captured from an app served by a checkout of the base commit (a disposable worktree at
`<repo>/.claude/worktrees/visual-base`, `yarn install`ed when its lockfile changes). That commit
must already carry the gate: `launch-app.mts --visual` and the drivers (plus the coverage hooks for
`--coverage`). Without `--base`, `base` uses `git merge-base HEAD origin/master`, and refuses if that
lacks the infra; until the gate is on master, always pass `--base <ref>` naming the commit before
your change.

`check`, `gate` and `coverage` compare against the commit the last `base` for that platform
captured (`base/last-<platform>.json`), or `--base`. The report title names the base used.

## Sittings: seal and frozen clock

A base and a check are taken minutes or days apart, so anything that can change between them is
pinned:

- **Seal.** A read-only snapshot of the account through the CLI: inbox (ids, names, unread,
  `activeAtMs`), teams and members, follows, devices, the team folder's listing. Each tour entry
  names the fields it shows. `base` and `gate` read a full seal before and after and are void if it
  changed (`gate void: … inbox[…].activeAtMs …`). `check` compares the entries' fields with the
  base's seal before capturing (`seal changed: …`). Traffic on the account voids runs; wait for a
  quiet account, or retake the base.
- **Frozen clock.** `Date` is fixed to the base's `frozenAt` (the newest message time + 60s), so
  relative times ("2m ago", day separators) render the same in base and check. Desktop fixes it
  with a page init script; iOS fixes it over Metro's inspector and remounts every screen.

## Determinism switches

- Desktop `--visual` launches Electron with `--disable-gpu --disable-partial-raster
  --force-color-profile=srgb` (see `electron-args.ts` for why each is needed), emulates the
  viewport and color scheme, hides overlay scrollbars and the caret, and parks the mouse outside
  the window.
- iOS: status bar override (9:41, full signal and battery), Reduce Motion and Reduce Transparency
  on (the app is relaunched to pick them up), auto-focused inputs blurred, and captures settle on
  two equal frames a second apart. `close` clears the status bar override; the app keeps the
  accessibility settings until its next launch.
- Each entry waits for its `ready` testID and then for the waiting store to be idle for 500ms.

## Masks

A mask hides a region from the compare. Only for content the server picks or pushes that no seal
field can pin, never for layout. Each one names a testID and a reason in `tour.ts`. A compare masks
the union of the base's and the current capture's mask rects. Current masks: people feed follow
suggestions, device last-used times.

## Coverage

`--coverage` builds mark every Box2 / ClickableBox JSX call site (outside `common-adapters/` and
`node_modules/`) so each capture records which ones mounted. Take a coverage base, then:

```sh
yarn visual:base --base HEAD --coverage        # desktop: relaunches the app with --coverage
yarn visual:base --base HEAD --coverage --ios  # iOS: restarts Metro with KB_VISUAL_COVERAGE=1 --clear
yarn visual:coverage HEAD..                    # working tree vs HEAD
```

`✗ never mounted: file.tsx:line` means the gate cannot see that change: add a tour entry that
reaches it, or prove it another way. Exit 1 if any are listed. Metro caches transforms per file,
not per env var, so switching coverage on or off needs `--clear` (the CLI does this).

Box2 itself (`common-adapters/box.tsx`) is covered separately: `box2-native-styles.test.tsx` pins
the native style of every prop combination (`yarn test:unit`), and the `Common/Box2 matrix`
stories pin the desktop classes: `yarn storybook:screenshot --only 'Common/Box2 matrix'`, copy
`tests/results/storybook-desktop` out as the baseline (every run deletes it), then rerun after the
change with `--compare <baseline dir>`.

## Guards

- **Lock.** One gate run at a time (`/tmp/kb-visual-gate.lock`, stale pids cleared). The regular
  Playwright and Appium e2e runs refuse to start while a gate run holds it.
- **Served-from.** Before capturing, the CLI checks that port 4000 (desktop) or 8081 (Metro) is
  served from this tree, and refuses otherwise. `base` checks the same for the base tree.
- **Deadlines.** Every wait has a deadline that names what it waited for; each command exits under
  an overall deadline. If `base` is interrupted while the app is served from the base tree, it
  prints the commands to restore your tree.
- **Read-only.** The tour only navigates, switches sub-tabs, opens popups and hovers. Nothing is
  sent, saved, toggled or confirmed, and every CLI call is read-only.

## Known exclusions

Routes the tour leaves out are listed with reasons at the bottom of `tour.ts`. Notable:

- `profile` (self): reopening a profile within 30s of closing it shows an empty profile with
  follower spinners that never finish (`tracker/identify-session.tsx`); also on master.
- Phone `files/team`: the header's "..." dots draw 1px off on the first push of a launch.
- Desktop chat info panel: it stays open for the conversation entries after it.
- Screens reached only through a write, or showing server-picked lists.
