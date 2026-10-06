# Visual gate

Pixel-exact screenshots of read-only screens, compared between a base commit and your working
tree. Use it to prove a layout refactor changes nothing on screen, or to see exactly what it
changes. The compare is exact RGBA with no threshold; a size mismatch is a failure.

Platforms: Electron light, plus dark with `--themes light,dark` (1280x800 @2x; layout never depends on the theme, so dark is opt-in), and iOS light on the `iPhoneTest` simulator
(`KB_IOS_DEVICE` overrides). The tour of screens is `tour.ts`: 173 desktop entries and 160 phone
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
| `yarn visual:coverage <range>` | Lists changed Box2 / ClickableBox call sites in `<range>` that no base capture drew |
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
non-`✓` line exits 1 and opens the HTML report (base/change slider, diff overlay, hatched masks);
`KB_VISUAL_NO_OPEN=1` only prints its path, for unattended runs.
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
  `activeAtMs`), teams and members, follows, devices, the team folder's and the private folder's
  listings, and the account's recent file edits (`fs history`, the menubar's recent files). Each tour entry names the fields it shows. `base` and `gate` read a full seal before
  and after and are void if it changed (`gate void: … inbox[…].activeAtMs …`). `check` compares the
  entries' fields with the base's seal before capturing (`seal changed: …`). Traffic on the account
  voids runs; wait for a quiet account, or retake the base. Adding a seal field changes what a seal
  holds, so a base taken before it reports `seal changed` on every check: retake the base.
- **Frozen clock.** `Date` is fixed to the base's `frozenAt` (the newest message time + 60s), so
  relative times ("2m ago", day separators) render the same in base and check. Desktop fixes it
  with a page init script; iOS fixes it over Metro's inspector and remounts every screen.

## Determinism switches

- Desktop `--visual` launches Electron with `--disable-gpu --disable-partial-raster
  --force-color-profile=srgb` (see `electron-args.ts` for why each is needed), emulates the
  viewport and color scheme, hides overlay scrollbars and the caret, pauses autoplay videos (giphy
  unfurls) on their first frame, and parks the mouse outside the window.
- iOS: status bar override (9:41, full signal and battery), Reduce Motion and Reduce Transparency
  on (the app is relaunched to pick them up), auto-focused inputs blurred, video players paused on
  their first frame, and captures settle on two equal frames a second apart. A `scrollIntoView`
  whose target does not show whole (as much of it as fits, for one longer than what scrolls it)
  scrolls it to the middle, as desktop's `scrollIntoViewIfNeeded` does (again once it stops moving,
  up to three times, while a row still laying out leaves it in part), from JS
  (`scrollToIndex` on the row holding it):
  Appium's `mobile: scroll` gives up on the inverted chat thread. `close` clears the status bar override; the app keeps the
  accessibility settings until its next launch.
- An entry that leaves its tab root (append, thread), acts on it (setup) or has a fixture waits
  for the waiting store to be idle for 500ms at the root first (so the tab under a modal has
  loaded); every entry waits again after its `ready` testID shows.

## Other windows

The menubar widget, the tracker popup, pinentry and unlock-folders are windows of their own
(`desktop/remote`). A `window/*` entry captures one of them instead of the main window, which it
resets to `nav.tab`; the window opens for the capture and closes after it, with the same ready,
setup, mask, settle, frozen clock (an init script in every remote window) and coverage as the main
window, and its content size emulated at 2x. The driver opens each the way the app does, from the
main window: the menubar with the preload's `makeRenderer` (the e2e launch has no tray; the main
window's proxy already sends its props), the tracker with a `trackerLoad` remote action for a user
(the identify is the profile's), and pinentry and unlock-folders, which open only on a service
request, with props from the tour sent through `rendererNewProps`. Nothing in the app is added for
it beyond testIDs.

## Params

An entry's route params are data: literals, plain objects and arrays (a wizard's state), and refs
that `resolve.mts` fills in through the read-only CLI (team, conversation, folders, users, and
`deviceID`, the account's device whose ID sorts first).

## Masks

A mask hides a region from the compare. Only for content the server picks or pushes that no seal
field can pin, and that no fixture supplies, never for layout. Each one names a testID and a reason
in `tour.ts`. A compare masks the union of the base's and the current capture's mask rects. The
tour has no masks now: fixtures replaced them.

## Fixtures

Content the server picks (follow suggestions, team builder recommendations, featured bots) or keeps
moving (device last-used times) is supplied by a dev-only fixture instead of masked, so the entry is
compared and counts for coverage. An entry names one with `fixture: {name, args}` (`args` are params
like nav's, refs resolved). The names are in `fixtures/names.ts`, the definitions in
`fixtures/<area>.ts`, typed against the app's RPC types.

The runtime (`fixtures/runtime.ts`) is in every dev build: the app entries (`app/index.native.tsx`,
`desktop/renderer/main2.desktop.tsx`) import it, and production builds resolve that import to an
empty module (`vite.config.mts`, `desktop/vite.node.mts`, `metro.config.js`;
`fixtures/prod-exclusion.test.mts`, which also refuses any other import of `fixtures/` from the app).
The engine never imports it: while a fixture is active the runtime sets `__kbVisualRpc`, and the
engine hands it every outgoing RPC and incoming call. A rule stubs an RPC (answered on a later tick, optionally with
calls into its session first) or transforms the live answer; a fixture can also rewrite incoming
calls (chat-thread-content adds its messages to a thread's replies), inject notifications after the
entry's ready state shows or right after an incoming call (`follow`: coin flip statuses once the
thread is in, so a setup step can reach them), hold the service's notifications, and set stores
directly. Prompts that
need an answer always pass. An RPC whose name says it writes (post, set, send, delete, create, add,
remove, mark) that no rule answers is refused, apart from a write the app makes when a screen loses
focus (the people screen's `homeMarkViewed`, which an iOS capture's tab hop causes): that is
answered empty and never reaches the service.

Per fixture entry the driver resets to the tab, waits for an idle app, begins the fixture, remounts
every screen (so none keeps live data) and waits for what they load (on iOS it then visits every tab
and hops back to the entry's, so the capture is not the remounted screen's first visit), navigates,
runs the setup, waits for `ready` (a testID only the fixture's data draws) and for every rule the
fixture needs to have answered, runs its afterReady, and captures. `end()` runs whatever happened:
it puts the fixture's stores back and reports a refused write, a reply still owed, a rewrite that
threw (live data without what the fixture builds on, like a thread page with no message of the
account's) or a store it could not restore, any of which fails the capture. Then every screen
remounts again (or the app reloads, if the fixture says so). Every capture first checks that no
fixture is active, and fixture entries run after every live entry (`fixtureOrderProblems`, in `yarn
visual:unit`). A base records a hash of each fixture's definition; `check` refuses when it changed
since, and `base` refuses a base commit whose fixture runtime speaks another version than the driver
(`FIXTURE_RUNTIME_VERSION`).

## Coverage

`--coverage` builds wrap every Box2 / ClickableBox JSX call site (outside `common-adapters/box.tsx`
and `node_modules/`) in a mark that draws its child unchanged and runs no hooks, so a coverage
build renders as a plain one. Each capture records the call sites drawn in its screenshot: at the
capture the driver walks the app's fiber tree for the marks (`coverage/visible.ts`) and counts a
site when one of its instances is on screen:

- desktop: one of its elements is rendered (not `display: none` or `visibility: hidden`, not
  empty, its opacity times its ancestors' above 0), overlaps the viewport once clipped by the
  ancestors that clip it, and shows at one of five points of that part (its centre and corners,
  inset 1px): `elementsFromPoint` lists nothing opaque above it there (an opaque background, an
  image or a video, at full opacity; not its own children). A translucent backdrop, like a modal's
  dim, covers nothing: the pixels under it still compare;
- phone: it is in the focused screen, or outside every screen (overlays, sheets), and one of its
  views has an opacity above 0 along its views, overlaps the window once clipped by the scroll
  views and `overflow: hidden` views around it, and is not covered. While the focused screen is a
  natively presented modal, only it and FullWindowOverlay content (popups, sheets) count: the
  views outside every screen are under the modal. A view outside every screen with an opaque
  background at full opacity that fills the window covers what is drawn under it. Views of one
  screen covering others of that screen are not modelled.

So a site mounted only on the way (a loading row replaced before ready), in a hidden tab or a
screen under the top one, scrolled out of view, transparent, or covered is not counted: no compare
sees its pixels. Where a rule cannot tell, it counts the site as not drawn, which only costs a
restored prop. The tab bar and other chrome count in every capture that draws them. A coverage
file without the `visible` flag is refused. Take a coverage base, then:

```sh
yarn visual:base --base HEAD --coverage        # desktop: relaunches the app with --coverage
yarn visual:base --base HEAD --coverage --ios  # iOS: restarts Metro with KB_VISUAL_COVERAGE=1 --clear
yarn visual:coverage HEAD                      # working tree vs HEAD (or a range, origin/master..HEAD)
```

A bare ref diffs the working tree against it; `A..B` diffs two commits. A range whose two sides
are the same commit (`HEAD..` is `HEAD..HEAD`), or that touches no `.tsx` file, is refused rather
than passed. Untracked new `.tsx` files are not in `git diff`: `git add -N` them (or commit) first.

`✗ never drawn: file.tsx:line` means the gate cannot see that change: add a tour entry that
reaches it, or prove it another way. Exit 1 if any are listed. Stories and tests (`*.stories.tsx`,
`*.test.tsx`) render outside the app and are out of scope here and in the codemod's reports. Metro caches transforms per file,
not per env var, so switching coverage on or off needs `--clear` (the CLI does this).

An entry with any mask counts for no coverage: a call site under a mask is drawn, but the compare
never sees its pixels. Each stored coverage file says whether its entry is masked; `coverage`
skips those and prints how many it skipped. A base written before that flag counts every entry;
retake it.

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
  prints the commands to restore your tree. A run past its deadline tries to close the capture
  session (real `Date`, theme, iOS status bar, appearance and accessibility settings) for up to a
  minute; a run stopped by Ctrl-C, or whose close fails, prints the commands that undo them. The
  driver's Appium is killed when the process exits.
- **Unread conversations.** Opening an unread conversation marks it read, so `base`, `check`,
  `gate` and `aa` refuse before capturing when the seal shows a conversation the tour opens as
  unread (`unread: <team>#e2e-short …`). Read it by hand, then rerun.
- **Read-only.** The tour only navigates, switches sub-tabs, opens popups, hovers, and presses or
  types into controls that change nothing but the screen in front of it. Nothing is sent, saved,
  toggled or confirmed, and every CLI call is read-only. Under a fixture, a write the app attempts
  is refused and fails the capture.

## Setup steps

An entry's `setup` runs after navigation, in order: `openPopup` and `switchSubTab` (a click),
`scrollIntoView`, `hover` (desktop), `click`, `type` and `searchThread`.

- `click` presses only a control in `CLICK_TARGETS` (`tour-types.ts`), and `type` types only into
  an input in `TYPE_TARGETS`: each is listed with what it does, and was checked to change only the
  screen's own state (expand the skin tones, select a member, add an unsaved new folder row and
  name it). Never add a send, save, create, confirm or delete control, or an input whose typing
  reaches the server (the chat composer saves a draft and sends typing notifications).
- `type` never submits. Its text may hold no line break, and its `enter` is allowed only for an
  input in `ENTER_TARGETS`, whose Enter stays local (thread search's field). `yarn visual:unit`
  checks all of this (`validateEntry`). Desktop fills the input; iOS calls the input's own
  `onChangeText`, since XCUITest's typing into a field that selects its text on focus loses
  characters.
- On iOS, `type` and `scrollIntoView` act on the view with the testID in the focused screen, or
  else one outside every screen (an overlay or sheet), and wait for it there: Appium's `~testID`
  also finds the views of hidden tabs and screens under the top one.
- `searchThread` opens the open conversation's thread search on a query by setting its route
  param, as the header's search button does, and so needs `nav.thread`.

## Known exclusions

Routes the tour leaves out are listed with reasons at the bottom of `tour.ts`. Notable:

- `profile` (anyone's): reopening a profile within 30s of closing it shows an empty profile with
  follower spinners that never finish (`tracker/identify-session.tsx`); also on master.
- Phone `files/team`: the header's "..." dots draw 1px off on the first push of a launch.
- A desktop floating menu stays open while its screen stays mounted, across Escape and tab
  switches. An entry that opens one carries `leavesPopup`; `yarn visual:unit` requires the next
  desktop entry to close it (same tab; on chat, another conversation), and selecting the entry by
  id also selects that follower.
- Phone menus are bottom sheets that expose nothing inside them to Appium: their entries wait on
  the screen under the sheet.
- Screens that write when opened, need data the account lacks, or wait on a system prompt.
