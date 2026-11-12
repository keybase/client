# Patches

What each `patch-package` patch here changes, why, and when it can go. A patch file is generated
output with no room for this, and a patch that only says what it changes cannot be judged on the
next bump.

One `##` section per patched package (its npm name, no version; `a > b` for a patch of the copy
of `b` nested under `a`), one `###` entry per independent change in that patch. Every entry has the same five fields. Every file the patch touches is named,
in backticks and by its path inside the package, in some entry's **Files**.

Keep it in step with the patch files: add or edit the entry in the same commit that changes a
patch, re-check **Upstream** whenever the package is bumped (give the date checked), and delete
the entry with its hunk. From `shared/`:

```bash
python3 ../.claude/skills/update-dependencies/find-workarounds.py --patches
```

prints every entry and fails if a patch, or a file inside one, is not described here, or if a
section here has no patch left. It checks files, not hunks: a new change in a file that is already
named still needs its own entry.

## @react-navigation/native-stack

### Header title view never zero-sized

- **Files:** `src/views/useHeaderConfigProps.tsx`, `lib/module/views/useHeaderConfigProps.js` (the `ScreenStackHeaderCenterView` style)
- **Why:** `UINavigationBar` takes a custom title view's size at its first layout and never lays out one that was zero-sized then. A `headerTitle` whose content arrives later (names not loaded on a cold start into a chat thread) stayed blank until the bar was rebuilt. `minWidth: 1, minHeight: 1` on the title view covers every custom title in the app. Added in #29893; there is no app-side fallback.
- **Upstream:** not reported (checked 2026-11-12).
- **Remove when:** native-stack or react-native-screens lays out a title view that grows from zero on its own.
- **Check:** iOS, without the hunk: hold the chat title empty for a few seconds after a cold start into a thread, then let the names load. The title must appear without leaving the screen.

### Left header items hide the native back button

- **Files:** `src/views/useHeaderConfigProps.tsx`, `lib/module/views/useHeaderConfigProps.js` (`hideBackButton`)
- **Why:** with `headerBackVisible: true` (our iOS default) react-native-screens renders `unstable_headerLeftItems` next to the native back button, so a screen with its own Cancel or Back item shows two. Non-empty left items now own the slot; an empty array keeps the native back button. The invariant is documented above `nativeBackHeaderItem` in `common-adapters/header-buttons.tsx`.
- **Upstream:** not reported; this is a behavior we want, not an upstream bug (checked 2026-11-12).
- **Remove when:** native-stack gives left items that meaning itself, or `unstable_headerLeftItems` is replaced by an API with a documented relation to the back button. Otherwise it stays.
- **Check:** iOS, without the hunk: a pushed screen with a custom left item (not a modal) must show one left button, not two.

## metro

### Fresh SHA-1 for worklets bundle-mode modules

- **Files:** `src/node-haste/DependencyGraph.js`
- **Why:** `react-native-worklets` Bundle Mode writes `react-native-worklets/.worklets/<hash>.js` during the babel transform. Metro's file map never crawled those files, so bundling fails with `Failed to get the SHA-1 for: .../.worklets/<n>.js`. The hunk hands such paths a throwaway hash.
- **Upstream:** not ours. It is the patch worklets ships for Bundle Mode, in `software-mansion/react-native-reanimated` under `packages/react-native-worklets/bundleMode/patches/patch-package/`. Still shipped there (checked 2026-11-12).
- **Remove when:** worklets stops shipping the metro patch (Metro supports these modules natively), or we turn Bundle Mode off (`worklets.staticFeatureFlags.BUNDLE_MODE_ENABLED` in `package.json`).
- **Check:** on a metro bump, re-take the hunk from that upstream directory rather than porting ours. Confirm the patch landed on the copy Expo bundles with (`require.resolve('@expo/metro/metro/node-haste/DependencyGraph')`; there must be one metro install), then `rm -f node_modules/react-native-worklets/.worklets/*.js` and run `expo export:embed --reset-cache`.

## metro-runtime

### Fast Refresh reaches worklet runtimes

- **Files:** `src/modules/HMRClient.js`
- **Why:** in Bundle Mode a hot update is evaluated on the JS runtime only, so worklet runtimes keep running the old module. The hunk forwards each update through `__workletsModuleProxy.propagateModuleUpdate`. Dev only.
- **Upstream:** not ours; same source and state as the `metro` patch above (checked 2026-11-12).
- **Remove when:** same as the `metro` patch. The two go together.
- **Check:** dev build: edit a worklet body, save, and the running animation or gesture must pick up the change without a reload.

## react-native-screens

### Navigation bar layout is not re-entered

- **Files:** `ios/RNSScreenStack.mm`, `ios/RNSScreenStackHeaderSubview.mm` (`layoutNavigationBar`), `ios/utils/UINavigationBar+RNSUtility.h`, `ios/utils/UINavigationBar+RNSUtility.mm`
- **Why:** `-[RNSNavigationController viewDidLayoutSubviews]` commits and mounts a shadow-tree update synchronously, and mounting forces another layout pass of the same navigation bar. On iOS 26 that nested pass crashes in `-[UINavigationController _effectiveSearchControllerForSearchBarGivenTopNavigationItem:]`. The patch marks the bar as being laid out and turns the nested pass into `setNeedsLayout`. Added in #29508 after a TestFlight crash.
- **Upstream:** software-mansion/react-native-screens#4483, open, not fixed on main (checked 2026-11-12; latest release 4.30.1).
- **Remove when:** #4483 is closed by a change that is in the release we install.
- **Check:** no local repro: it came from crash reports. Remove only on the upstream fix, then watch crash reports for that signature on the next build.

### Header subviews enumerated over a copy

- **Files:** `ios/RNSScreenStackHeaderConfig.mm`
- **Why:** updating a header subview's shadow state mounts synchronously and can add or remove header subviews while `reactSubviews` is being enumerated: `NSGenericException`, collection mutated while being enumerated. The comment in the hunk cites #4483; the matching upstream issue is #4811.
- **Upstream:** fixed on main by software-mansion/react-native-screens#4851 (issue #4811), merged 2026-10-21, not in 4.30.1 (checked 2026-11-12).
- **Remove when:** bumping to the first release that contains #4851 (expected 4.31). The hunk will then fail to apply; drop it instead of porting it.
- **Check:** the new version's `RNSScreenStackHeaderConfig.mm` iterates `[self.reactSubviews copy]` in `updateHeaderStateInShadowTreeInContextOfNavigationBar`.

### Empty navigation bar takes no safe area

- **Files:** `ios/RNSScreen.mm`
- **Why:** unhiding a hidden bar during a push makes iOS 26 slide the whole `UINavigationBar` in as its own plane, out of step with the screen. The tabs screen keeps an empty transparent bar visible instead, marked with `headerBackTitle: 'RNS_EMPTY_BAR'` (`router-v2/router.tsx`), and this hunk cancels that bar's safe-area inset so nested headers do not shift down by its height. Added in #29409.
- **Upstream:** software-mansion/react-native-screens#3773, open (checked 2026-11-12).
- **Remove when:** #3773 is fixed in the release we install and the tabs screen can go back to a hidden header. Remove it together with the `RNS_EMPTY_BAR` options in `router-v2/router.tsx` and the comments in `router-v2/routes.tsx` and `login/routes.tsx`.
- **Check:** iOS 26, with the tabs screen's header hidden and this hunk gone: push from a tab root into a chat thread and from login into "Create account". The bar must not slide separately or flash.

### Custom bar button items keep a stable identifier

- **Files:** `ios/RNSScreenStackHeaderSubview.mm` (`configureBarButtonItem`)
- **Why:** without an identifier UIKit treats the custom left and right items of each screen as new, and on iOS 26 plays the glass assemble animation on every push and pop. A fixed per-slot identifier lets it morph them in place. Added in #29302.
- **Upstream:** not reported (checked 2026-11-12).
- **Remove when:** react-native-screens sets an identifier on custom bar button items itself.
- **Check:** iOS 26, without the hunk: push and pop between two screens that both have a custom right item. The item must morph in place, not re-assemble.

### Tab bar selection not animated at startup

- **Files:** `ios/tabs/host/RNSTabBarController.mm`
- **Why:** when the app starts on a tab other than the first, the first selection animated: the iOS 26 glass pill slid from tab 0 to the startup tab. The first selection now runs inside `performWithoutAnimation`. Added in #29622.
- **Upstream:** not reported (checked 2026-11-12).
- **Remove when:** react-native-screens applies the initial tab selection without animation.
- **Check:** iOS 26, without the hunk: cold start onto a tab other than the first. The pill must already be on the startup tab in the first frame.
