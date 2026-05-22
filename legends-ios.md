# LegendList iOS Chat Debugging

## Problem Statement

When scrolling to the top of the chat thread, older messages are loaded. When those messages arrive, some content briefly flashes at the top of the list for ~1 frame before settling into position. This is NOT the scroll position jump problem (that's fixed) — it's a visual glitch where incoming content overlays on top of existing content momentarily, then disappears/settles.

**Current props of interest:**
- `maintainVisibleContentPosition={{data: true, size: true}}`
- `maintainScrollAtEnd={centeredOrdinal !== undefined ? false : {on: {dataChange: true}}}`
- `alignItemsAtEnd={true}`
- `recycleItems={false}`

---

## Experiments

### Experiment 1: Simplified colored boxes + logging (current)
**Hypothesis:** Real chat rows have complex rendering (images, reactions, etc.) that may interact badly with LegendList's measurement pass. Simplifying to fixed-size colored boxes will help isolate whether the flash is a measurement issue vs. a LegendList virtualization issue.

**Changes:**
- `DEBUG_LEGEND = true` in `list-area/index.tsx` swaps all rows for colored boxes with ordinal labels
- Colors cycle by render index so every adjacent row is a different color
- Heights are deterministic by ordinal: `[40, 55, 72, 90, 120, 48, 65, 100, 35, 160]px`
- `ListHeaderComponent` replaced with a simple dark bar ("── LIST HEADER ──") to eliminate "Digging ancient messages..." as a variable
- Index 0 item labeled "TOP: {ordinal}" with a black top border so the list boundary is always visible
- Logging: `onStartReached`, data length changes (prepend), `totalSize` listener, `onLoad`, per-row `onLayout` (flags measured ≠ expected)

**To test:** Scroll to the top of a long thread. Watch for flash. Also check Metro logs.

**Observations:**
- Flash still visible with debug boxes + simplified header
- In image 3: white gap between 13858 and 13859, with 13859/13860 overlapping → confirmed flash is list-level, not chat-row rendering
- In image 4: large white space above LIST HEADER bar → list has bounced past top when header is revealed

**Status:** Ongoing → Experiment 2

---

### Experiment 2: Disable bounce during load (`bounces={false}` in debug mode)
**Hypothesis:** iOS bounce animation is in-flight when new items arrive. `maintainVisibleContentPosition` applies a scroll offset adjustment that conflicts with the bounce physics, causing the 1-frame visual glitch.

**Changes:**
- `bounces={!DEBUG_LEGEND}` — bounce disabled when `DEBUG_LEGEND = true`

**To test:** Scroll to top, let it bounce, watch for flash. If flash disappears → bounce is the culprit and we need to either disable bounce permanently or pause `onStartReached` while bouncing.

**Observations:**
- Flash is "a bit better" with bounces=false
- **New problem:** when 99 items load in, all swipe momentum is killed dead

**Log analysis from this run:**
```
onStartReached count=119 scroll=208.0        ← load triggered, user still moving fast
totalSize=17526.4 scroll=61.7               ← LegendList internal resize (fires during render, before effects)
ordinals 119→217 (+98) scroll=7985.0        ← React effect runs; MVCP already jumped scroll from 61 → 7985
```
- `totalSize` fires during the React render pass (synchronous), before the React `useEffect` runs — so by the time our effect records `scroll=7985`, the MVCP jump has already happened
- The jump (61 → 7985) is ~7924px = height of 98 new prepended items — correct, but iOS kills momentum on any programmatic `contentOffset` change
- `totalSize` fluctuates constantly while scrolling (9258→9340→9301→9278…) because each newly-visible item's measured size replaces its estimated size → each measurement triggers a micro-MVCP adjustment while the user is in motion

**Root cause of velocity kill:** iOS cancels scroll momentum whenever `contentOffset` is set programmatically. The MVCP adjustment is a programmatic set. With `bounces=true` this was hidden because the bounce physics re-absorbed the jump; with `bounces=false` the kill is obvious.

**Status:** Done — bounce re-enabled (velocity kill was masking, not causing the flash)

---

### Experiment 3: Uniform fixed-height boxes + exact estimatedItemSize
**Hypothesis:** The constant `totalSize` fluctuation (9258→9340→9301…) during scrolling is caused by individual items being measured and replacing their estimated size. Each measurement triggers a micro-MVCP scroll adjustment while in motion, contributing to instability and possibly the flash. Making all boxes exactly `DEBUG_FIXED_HEIGHT=72` and setting `estimatedItemSize=72` eliminates measurement-driven adjustments entirely — if the flash disappears, size estimation noise is the culprit.

**Changes:**
- All debug boxes: uniform `height=72` (no variation)
- `estimatedItemSize=72` (exact match — LegendList should never need to adjust for measurement delta)
- `onLayout` only logs when measured height differs by >0.5px from expected (noise reduction)
- `bounces` restored to default

**To test:** Scroll to top, trigger load. Watch for flash. Also watch Metro for `totalSize` fluctuation — should now be stable jumps only (one big jump when items prepend, then flat).

**Observations:**
- Flash is visually better — measurement noise was a real contributor
- `totalSize` now fires exactly once per load (no fluctuation) — confirmed uniform heights eliminate micro-adjustments
- Log is clean: one `totalSize`, one `ordinals` change per load

**Log pattern (both loads identical shape):**
```
onStartReached count=20 scroll=276.7
totalSize=8568.0 scroll=119.0       ← during render; 119 items × 72 = 8568 ✓
ordinals 20→119 (+99) scroll=7247.0 ← MVCP jumped 119→7247 (delta=7128 = 99×72 ✓)

onStartReached count=119 scroll=337.3
totalSize=15624.0 scroll=260.0      ← 217×72 = 15624 ✓
ordinals 119→217 (+98) scroll=7316.0
```
- Delta is exact: 99×72=7128, scroll 119→7247=7128 ✓ — MVCP math is correct
- The scroll at `totalSize` time (119, 260) shows the "danger window": new items are in LegendList but scroll hasn't been adjusted yet. This is the frame where the flash occurs.
- Flash still present (better, not gone) → root cause is not measurement noise alone; the MVCP adjustment itself has a 1-frame lag where new items are positioned at the top while scroll is still at the old offset

**Status:** Done → Experiment 4

---

### Experiment 4: Disable `maintainVisibleContentPosition` entirely
**Hypothesis:** The 1-frame lag is caused by MVCP applying its scroll adjustment asynchronously (after commit). Disabling MVCP will remove the flash (but will cause scroll to jump to the top — terrible UX, but useful as a diagnostic). If flash disappears without MVCP, the flash is definitively caused by the async adjustment timing.

**Changes (to try):** Set `maintainVisibleContentPosition={undefined}` regardless of centeredOrdinal.

**To test:** Scroll up, trigger load, watch for flash. Expect scroll to jump, but does the flash disappear?

**Observations:**
- Can't keep MVCP off: without it, new items land at top while scroll stays put → non-contiguous history + runaway load loop (onStartReached keeps firing at scroll≈0)
- **Root cause confirmed:** Without MVCP, `totalSize` and `ordinals` fire at the SAME scroll value (170.3, 170.3) — no jump. With MVCP on, they diverge (119 → 7247). The flash IS the 1-frame gap between LegendList committing new item positions and its async `scrollTo` adjustment landing.
- Tiny subpixel totalSize drift (~0.1–0.4px) persists even with uniform 72px items — device pixel ratio rounding, not measurement noise.
- MVCP restored.

**Root cause summary:** LegendList's `maintainVisibleContentPosition` works by firing `scrollTo` *after* the native layout commit. For one native frame, new prepended items sit at positions 0–7128px while scroll is still at the old offset (~119px), making them briefly visible. The subsequent `scrollTo` to 7247 lands one frame later.

**Status:** Done → root cause identified

---

### Experiment 5: Options to fix the 1-frame MVCP lag

The flash is a 1-frame gap between LegendList rendering new items and its async `scrollTo` landing. Possible approaches:

**A) Opacity shield:** When `onStartReached` fires, briefly set list opacity to 0. Restore after ordinals change + 1 frame. Hides the flash but adds a blink.

**B) `setScrollProcessingEnabled(false)` around the update:** LegendList exposes this on the ref. If it defers scroll processing until re-enabled, it may batch the position adjustment atomically. Worth trying.

**C) File a LegendList bug:** The async 1-frame lag in MVCP is arguably a LegendList issue. The fix would need to happen inside LegendList (e.g., pre-adjust scroll offset before committing new item layout). Worth opening an issue with this reproduction.

**D) Pre-scroll before data arrives:** After `onStartReached`, immediately scroll to a large offset so that when items prepend, the visible area is already in safe territory. Hacky and fragile.

**Status:** Implementing option C (patch)

---

### Experiment 5: Patch @legendapp/list to eliminate 1-frame RAF delay

**Root cause confirmed:** `keyboard-chat.js` imports from `@legendapp/list/react-native.js`. That file's `ScrollAdjust` uses `Animated.View` and updates the anchor position via `requestAnimationFrame(flush)` — an explicit 1-frame deferral. This is why the anchor is always one frame late when new items are prepended.

**Option B analysis:** `setScrollProcessingEnabled(false)` only gates the `onScroll` handler (`if (scrollProcessingEnabled === false) return;`) — it doesn't touch the MVCP/requestAdjust path at all. Skipped.

**The patch (in `patches/@legendapp+list+3.0.0-beta.56.patch`):**

In `react-native.js`'s `ScrollAdjust`:
- Store `scrollOffset$` (the `Animated.Value`) and `bias` on `ctx.state`

In `react-native.js`'s `ScrollAdjustHandler.requestAdjust`:
- Before the `set$(scrollAdjust)` call (which triggers the RAF-deferred `setValue`), immediately call `animatedValue.setValue(newOffset)` synchronously
- On New Architecture (JSI), `Animated.Value.setValue` updates the native UI thread before the next frame

Also patched `index.native.js` similarly (not used by `keyboard-chat` but kept for consistency).

**To test:** Scroll to top, trigger load. Flash should be gone.

**Observations:**
- Visual: "seems better, a little hard to tell" — flash reduced but may not be fully eliminated
- Log pattern (with patch):
  ```
  onStartReached count=20 scroll=216.0
  totalSize=8568.0 scroll=216.0       ← SAME scroll as trigger (was 119 before patch)
  ordinals 20→119 (+99) scroll=7344.0 ← MVCP jump still present (delta=7128=99×72 ✓)
  ```
- Key change: `totalSize` now fires at scroll=216 (same as trigger), not at a lower value like 119. Before the patch, the user had scrolled further up between the trigger and the resize event. This suggests the synchronous `setValue` is changing native timing — the anchor view moves sooner, causing the MVCP scroll adjustment to happen faster.
- `ordinals` still shows the 7128px MVCP jump — expected, MVCP is still working correctly.
- The "danger window" appears to be shorter but may not be zero: new items are rendered → setValue fires synchronously → native processes anchor move → MVCP adjusts scroll. If setValue→MVCP path is fully synchronous (JSI), flash should be gone. If not fully atomic, 1 frame may remain.

**Status:** Partially confirmed — visual improvement with debug boxes, worse with real items → Experiment 6

---

### Experiment 6: `maintainVisibleContentPosition={data: true, size: false}`

**Root cause of "10 frames" with real items:** `size: true` triggers a MVCP `requestAdjust` call for every item whose measured height differs from `estimatedItemSize`. With 99 real items each measuring at different heights, each measurement fires: `requestAdjust` → sync `setValue` (our patch) → native MVCP (still 1 frame async). That's a continuous stream of 1-frame-lagged corrections across many frames — ~10 frames of instability instead of 1.

Log evidence:
```
totalSize=7507.3  scroll=186.0
scrollAdjust=5159.3  scroll=5345.3   ← initial data-prepend jump ✓
totalSize=7521.8  scroll=5345.3
scrollAdjust=5173.8  scroll=5359.8   ← measurement-driven +14.5px
totalSize=7555.1  scroll=5358.8
scrollAdjust=5208.1  scroll=5394.1   ← batched +35.3px
... (continues for many more frames)
```

Debug boxes had this problem too (Exp 3) but was eliminated by exact estimatedItemSize — zero measurement deltas = no storm.

**Change:** `maintainVisibleContentPosition={{data: true, size: false}}`

- `data: true` — still fires one MVCP jump when items are prepended (correct)
- `size: false` — stops MVCP from firing on every measurement delta (eliminates storm)

**Tradeoff:** If items already in the list later change height (image loads, unfurls expanding), scroll position won't compensate. But those are rare, low-frequency events unlike the burst of 99 measurements at once.

**To test:** Scroll to top, trigger load. Flash should be reduced to at most 1 frame (just the initial data jump).

**Observations:** (fill in)

**Observations:** "4 frames" with real items. Log shows scroll is now STABLE throughout all totalSize changes (size: false working). But 4-frame flash remains.

**Root cause of remaining 4-frame flash:** LegendList warns "No unused container available... creating one on demand" with `numContainers: 20, numNeeded: 20, stillNeeded: 13`. After MVCP, 20 old item containers are all within drawDistance range → `findAvailableContainers` Pass 2 finds nothing reusable → 13 complex new-item containers created on demand. Rendering 13 complex message components (avatar, text, reactions) spreads across ~4 React Concurrent Mode time slices.

Log also confirmed: LegendList uses `averageSizes[itemType].avg` (~52px, from measured old items) NOT `estimatedItemSize=72` for new item sizing.

**Status:** Done → Experiment 7

---

### Experiment 7: `recycleItems={true}`

**Hypothesis:** With `recycleItems={false}`, all 20 old item containers are in-range after MVCP → `findAvailableContainers` can't reuse any → creates 13 on demand. Rendering 13 new complex message components spreads across ~4 Concurrent Mode time slices → 4 frames of instability.

With `recycleItems={true}`, old items 110-118 (at positions > drawDistance past viewport ~6389) ARE out of range after MVCP → their ~9 containers become reusable. On-demand creation drops from 13 to ~4. Fewer new renders → flash duration reduced.

**Change:** `recycleItems={false}` → `recycleItems={true}`

**Risk:** Recycled containers might briefly show wrong item content before React updates them ("recycling flash"). On New Architecture (Fabric), this should be minimal since view updates are synchronous within a commit.

**To test:** Scroll to top, trigger load. Watch if flash is shorter or different character.

**Observations:**
- WORSE: breaks MVCP position maintenance. When new content arrives, existing items don't stay in their old spots — maintainVisibleContentPosition effectively stops working.
- Reverted immediately to `recycleItems={false}`.

**Root cause of regression:** LegendList's position maintenance relies on stable container-to-ordinal mapping. Recycling containers away from tracked ordinals breaks the scroll anchor.

**Status:** Done → reverted → Experiment 8

---

### Experiment 8: Hide prepended items with `opacity: 0` during pre-MVCP window

**Root cause to address:** During the pre-MVCP flash window, newly prepended items are rendered at estimated positions near the viewport (based on LegendList's average size ~52px) while scroll is still at the old position (~273px). For ~4 frames, both new and old items overlap in the viewport before MVCP fires to push scroll to ~5432px.

**Insight:** The newly prepended items are ones the user has NEVER seen — they'll be above the viewport after MVCP fires. So hiding them during the flash window has zero UX cost: the user wasn't going to see them at the correct position anyway.

**Approach:**
- `PrependContext` — React context that carries the "cutoff ordinal" (the old `messageOrdinals[0]` before the prepend)
- `useLayoutEffect` on `messageOrdinals` — fires before paint; reads `messageOrdinalsRef.current` (still holds previous render's value, since its `useEffect` hasn't run yet) to detect `currFirst < prevFirst`
- Sets `prependedBeforeOrdinal = prevFirst` synchronously in the commit phase
- `useEffect` with 150ms timeout clears it
- `NativeMobileRow` reads `PrependContext` and applies `opacity: 0` when `ordinal < prependedBefore`
- `renderItem` stays stable (no re-creation on prepend) — context bypasses `React.memo`

**Changes:**
- `PrependContext` added before `NativeMobileRow`
- `NativeMobileRow` wraps in `Kb.Box2` with `style={isPrepended ? {opacity:0} : undefined}`
- `prependedBeforeOrdinal` state + `useLayoutEffect` (detect) + `useEffect` (clear 150ms) in `NativeConversationList`
- `PrependContext.Provider` wraps the list JSX

**To test:** Scroll to top, trigger load. Flash should be gone (items hidden before they could be visible). Watch logs for "prepend detected" and "prepend opacity cleared" messages.

**Observations:**
- "Scrolling seems really jittery and busted... still pushes items down and doesn't maintain scroll position"
- Root cause of jitter: the `PrependContext` caused ALL rendered NativeMobileRows to re-render twice per prepend (once when set, once cleared 150ms later). Even when `isPrepended=false` and the row's output is unchanged, the re-render + potential React Native native view update triggers `onLayout` bursts, throwing off LegendList's position calculations.
- Reverted to Fragment return unconditionally, removed PrependContext entirely.

**Status:** Done → reverted → Experiment 9

---

### Experiment 9: `drawDistance={500}` to eliminate on-demand container creation

**Root cause of remaining 4-frame flash:** The container pool is sized at init using `numContainers = ceil((scrollLength + drawDistance*2) / avgItemSize)`. With `drawDistance=250` and avgItemSize≈72: `ceil((850+500)/72) = 19` → ~20 containers. Pool is then capped at `max(dataLength, numContainers)`. At init, `dataLength=20`, so pool=20.

After prepend of 99 items, LegendList needs `numNeeded≈23` containers (viewport + drawDistance coverage). Pool has 20 → 13 must be created on demand via `findAvailableContainers` Pass 3. Each on-demand creation = new React component tree rendered in Concurrent Mode = spread across ~4 time slices.

**Fix:** `drawDistance=500` gives:
- `numContainers = ceil((850+1000)/72) = 26`
- Pool at init = `max(20, 26) = 26`
- After prepend: numNeeded≈23 < 26 → ZERO on-demand creations → no Concurrent Mode spreading → flash drops from 4 frames to ≤1 frame

**Tradeoff:** 500px pre-rendered above+below viewport vs 250px. ~6 extra rows always rendered. Acceptable memory/CPU cost.

**To test:** Scroll to top, trigger load. Watch for flash. Check for `"No unused container"` warning in Metro — it should be GONE.

**Observations:**
- WORSE — "things are flashing all over the place"
- Root cause: `drawDistance=500` pre-renders 6 more rows (26 vs 20). Chat rows contain complex content. More pre-rendered rows = more `onLayout` events firing during normal scrolling from LegendList repositioning items (even when height is stable). This throws off LegendList's position calculations more frequently → jitter throughout scrolling, not just during prepend.
- Added `onLayout` wrapper (DEBUG_LOG only) to detect row resizing: **confirmed NO ROW RESIZE events** — all rows are height-stable after first render. Images, unfurls, text all have fixed heights.
- The `totalSize` oscillations come from LegendList's OWN container measurement of newly-rendered items (replacing averageSize estimates with real heights), not from our rows resizing.
- Reverted `drawDistance` back to 250.

**Key insight:** Increasing `drawDistance` increases pre-rendered row count, amplifying LegendList's internal measurement churn. Not the right lever.

**Status:** Done → reverted → Experiment 10

---

### Experiment 10: Patch `getInitialContainerPoolSize` to remove `maxUsefulPoolSize` cap

**Root cause:** `getInitialContainerPoolSize` caps the pool at `Math.min(maxUsefulPoolSize, targetPoolSize)` where `maxUsefulPoolSize = Math.max(dataLength, numContainers)`. With `dataLength=20` and `numContainers=20`, pool is always 20 — even though `initialContainerPoolRatio=3` (the default!) would give `targetPoolSize=60`.

The cap exists to avoid "wasted" containers when data is small. But for a chat app that loads more items on scroll, those "spare" containers become essential immediately at the first scroll-back.

**Fix:** Remove the `maxUsefulPoolSize` cap — just return `targetPoolSize`. With `numContainers=20` and `ratio=3`: pool=60 at mount. 40 are free (unassigned) containers. When 12 new items need containers after prepend: all 12 served from the free pool in Pass 1 of `findAvailableContainers`. No on-demand creation. No Concurrent Mode spreading. Flash drops from 4 frames to ≤1 frame.

**Cost:** 40 extra container React components rendered at mount. Each renders null/empty (positioned off-screen at `top: -1e7`). Memory/CPU cost is negligible.

**Patch:** `getInitialContainerPoolSize` in `react-native.js`: `return Math.min(maxUsefulPoolSize, targetPoolSize)` → `return targetPoolSize`

**To test:** Scroll to top, trigger load. Watch for flash AND watch for `"No unused container"` warning — it should be GONE.

**Observations:**
- App crashes with OOM (EXC_BAD_ACCESS SIGSEGV) when scrolling up repeatedly
- MALLOC: 1.5G across 1242 regions, VM_ALLOCATE: 512MB
- Crash in `HermesRuntimeImpl::createStringFromAscii` → JSI OOM at JS layer
- 40+ `com.apple.coremedia.sharedRootQueue` threads active in crash dump
- This did NOT happen before our patches

**Root cause investigation:**
- Our patch went from pool=20 → pool=60 (40 extra Container React components always mounted)
- Each Container has multiple `useArr$` subscriptions to the observable state
- With recycleItems=false and container reuse, subscriptions may accumulate
- Reverting pool fix first to isolate whether it's the culprit

**Status:** Reverted (pool fix removed from react-native.js and patch file) → bisecting OOM

---

### Experiment 10b: OOM bisect — pool fix reverted, does OOM stop?

**Change:** Reverted `return targetPoolSize` back to `return Math.min(maxUsefulPoolSize, targetPoolSize)` in `getInitialContainerPoolSize`. Pool is 20 again at mount.

**Observations:** Still crashes. Pool fix was NOT the OOM cause.

**Status:** Done → Animated.Value patch reverted next

---

### Experiment 10c: OOM bisect — all patches removed

**Change:** Deleted patch file entirely, reverted both index.native.js and react-native.js to vanilla LegendList. Zero custom patches applied.

**Observations:** Still crashes. OOM is a plain LegendList bug, not caused by any of our patches.

**Root cause:** LegendList itself leaks memory when scrolling up repeatedly to load older messages. Likely related to how it accumulates native resources (CoreMedia threads from video content) in mounted containers as more items load. This is a LegendList upstream issue.

**Status:** Stopping investigation. OOM is out of scope for this session — it's a LegendList bug to report upstream.

---

## Notes on LegendList internals

- `scrollAdjust` — amount the list adjusted scroll offset to maintain position after a data change
- `scrollAdjustPending` — adjustment queued but not yet applied (non-zero during the frame the flash could occur)
- `maintainVisibleContentPosition: {data: true, size: true}` — restores position when data OR sizes change
- `alignItemsAtEnd={true}` — short lists align to bottom (like a chat)

## Key questions

1. Does `scrollAdjustPending` spike to a non-zero value exactly when the flash occurs?
2. Does the flash occur with simple fixed-height boxes (no measurement needed)?
3. Does the flash occur with variable-height boxes?
4. Does `estimatedItemSize` accuracy affect the flash?
