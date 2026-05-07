# Animations Performance and Accessibility

Reanimated 4 requires the New Architecture (Fabric). All guidance here assumes that.

---

## 120fps Support

Enable ProMotion display support on iOS by adding to `Info.plist`:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

Without this flag, iOS caps animations at 60fps even on ProMotion devices.

---

## Feature Flags

Reanimated 4 exposes feature flags to opt into fixes for known New Architecture issues. Enable them early in your app entry point, before any Reanimated code runs.

### Flickering / Jittering While Scrolling

Animated components like sticky headers flicker during `FlatList` or `ScrollView` scrolling on the New Architecture.

**Fix:** Upgrade to React Native 0.81+ and enable:
- `preventShadowTreeCommitExhaustion` (experimental release-level flag in RN)
- `DISABLE_COMMIT_PAUSING_MECHANISM` (Reanimated feature flag)

### FPS Drops During Scrolling

FPS drops when many animated components are visible during scroll.

**Fix:** Upgrade to React Native 0.80+ and Reanimated 4.2.0+, then enable:
- `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`

Alternative: Enable `enableCppPropsIteratorSetter` (experimental).

### Low FPS with Many Simultaneous Animations

**Fix:** Enable platform-specific synchronous UI update flags:
- `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` (available since 4.0.0)
- `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS` (available since 4.2.0)

Note: these flags may interfere with touch detection on animated `transform` elements. Prefer `Pressable` from `react-native-gesture-handler` over the core `Pressable` when using these flags.

---

## Simultaneous Animation Limits

Reanimated can handle many animated components, but performance degrades at scale:

| Platform       | Practical limit |
|----------------|-----------------|
| iOS            | ~500 components |
| Low-end Android | ~100 components |

For lists with many animated items, consider reducing animation complexity on low-end devices using `useReducedMotion`. For highly complex animation scenes (hundreds of elements), consider Reanimated + `react-native-skia` instead of animating native views.

---

## Prefer Non-Layout Properties

Animating layout properties (`top`, `left`, `width`, `height`, `margin`, `padding`) forces a layout pass on every frame.

Prefer properties that use the fast path:
- `transform` (`translateX`, `translateY`, `scale`, `rotate`)
- `opacity`
- `backgroundColor`

If a design requires a size change, consider `scale` transforms for the same visual effect without triggering layout.

---

## Avoid Reading Shared Values on the JS Thread

Reading `sv.value` inside React render, event handlers, or `useEffect` triggers a synchronization from the UI thread to the JS thread, which can block the JS thread.

Instead, use `useDerivedValue` to transform shared values and `useAnimatedStyle` to consume them — both run on the UI thread.

---

## Memoize Callbacks and Gesture Objects

Frame callbacks and gesture objects are re-created on every render by default. Wrap them:

```tsx
const frameCallback = useFrameCallback(
  useCallback((frameInfo) => {
    // runs on UI thread every frame
  }, [])
);

const gesture = useMemo(() =>
  Gesture.Pan().onUpdate((e) => {
    offset.value = e.translationX;
  }),
  []
);
```

If React Compiler is available, it handles memoization automatically.

---

## Worklet Closure Optimization

Worklets capture variables from their surrounding scope. Capturing large objects causes performance issues due to serialization overhead.

```tsx
// Bad: captures entire theme object
const theme = useTheme();
const style = useAnimatedStyle(() => ({
  backgroundColor: theme.colors.primary,
}));

// Good: extract only what is needed
const primaryColor = useTheme().colors.primary;
const style = useAnimatedStyle(() => ({
  backgroundColor: primaryColor,
}));
```

Extract specific properties before the worklet to minimize the closure payload.

Functions marked with `'worklet'` are not hoisted. They must be defined before they are referenced in other worklets.

---

## Debug vs. Release Builds

Always profile animations in a release build. Debug builds add significant JS overhead (Metro bundler, Hermes debug mode, dev warnings) that makes animations appear slower than they are in production.

```
npx react-native run-android --mode=release
```

On Android, use `debugOptimized` build variant for a better dev experience with closer-to-production performance.

---

## Accessibility

### useReducedMotion

```tsx
const reduceMotion = useReducedMotion();
```

Returns `true` if the device has reduced motion enabled **at app start**. Does not update at runtime if the user changes the setting.

Use it to conditionally render animations or pick simpler alternatives:

```tsx
<Animated.View entering={reduceMotion ? undefined : FadeIn} />
```

### ReducedMotionConfig

Sets global animation behavior for the entire app:

```tsx
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

// Place near app root
<ReducedMotionConfig mode={ReduceMotion.System} />
```

Modes:
- `ReduceMotion.System` (default) — follow device setting
- `ReduceMotion.Always` — always disable animations
- `ReduceMotion.Never` — always enable animations

### Behavior per animation type when reduced motion is enabled

| Animation | Behavior |
|-----------|----------|
| `withSpring`, `withTiming` | Jump to `toValue` immediately |
| `withDecay` | Return current value (respecting clamp) |
| `withDelay` | Start next animation immediately |
| `withRepeat` (infinite or even + reversed) | Do not start |
| `withRepeat` (other) | Run once |
| `withSequence` | Only start children with `reduceMotion: Never` |
| Entering / keyframe / layout animations | Jump to endpoint immediately |
| Exiting / shared element transitions | Omitted entirely |

Higher-order animations pass their `reduceMotion` config to children unless a child has its own explicit config.
