# Animation Functions and Core Hooks

Gotchas, rules, and patterns for Reanimated 4 core hooks, animation functions, and modifiers.

For API signatures and config options, webfetch the linked documentation pages below.

For choosing between animation approaches (CSS vs shared value), see **`animations.md`**.

---

## Worklet Directive

Do **not** add `'worklet';` to callbacks passed to Reanimated and Worklets APIs (`useAnimatedStyle`, `useAnimatedProps`, `useDerivedValue`, `useAnimatedReaction`, `useAnimatedScrollHandler`, `useFrameCallback`, gesture callbacks, animation callbacks). The Reanimated Babel plugin auto-workletizes these. The `'worklet';` directive is only needed for standalone functions you define yourself and want to run on the UI thread.

---

## Core Hooks

### [useSharedValue](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue)

**Gotchas:**
- Never destructure: `const { value } = sv` breaks reactivity.
- For objects, reassign the entire value: `sv.value = { ...sv.value, x: 50 }`. Direct mutation (`sv.value.x = 50`) loses reactivity.
- For large arrays/objects, use `.modify()` to mutate in place: `sv.modify(arr => { arr.push(item); return arr; })`.
- Reading `.value` on the JS thread blocks until the UI thread syncs. Minimize cross-thread reads.
- Never read/modify during component render. Access only in callbacks (`useAnimatedStyle`, event handlers, `useEffect`). Reanimated will warn: _"Reading from `value` during component render"_ / _"Writing to `value` during component render"_.
- Use `.get()`/`.set()` methods instead of `.value` for React Compiler compatibility.
- **Avoid using a shared value exclusively on the JS thread.** If you only need the value on the JS thread, use `useState` instead. Reading a shared value on the JS thread is slow (requires thread synchronization) and may return a stale value. A common mistake is reading or updating a shared value in the component body (during render):

```tsx
// BAD: reading/writing shared values during render
function Counter() {
  const count = useSharedValue(0);

  // Triggers "Reading from value during component render" warning
  const doubled = count.value * 2;

  return (
    <Animated.View>
      {/* Triggers "Writing to value during component render" warning */}
      <Button onPress={() => { count.value += 1; }} title={`Count: ${count.value}`} />
    </Animated.View>
  );
}

// GOOD: shared value used for UI-thread animations
function AnimatedCounter() {
  const offset = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Button onPress={() => { offset.value = withSpring(offset.value + 50); }} title="Move" />
    </Animated.View>
  );
}
```

### [useAnimatedStyle](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedStyle)

```tsx
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: withSpring(offset.value) }],
}));

<Animated.View style={[styles.box, animatedStyle]} />
```

**Rules:**
- Keep static styles in `StyleSheet.create()`. Only put dynamic parts in `useAnimatedStyle`.
- Animated styles override static styles in the style array.
- Removing an animated style does not unset its values. Manually set properties to `undefined` to clear them.
- Never mutate shared values inside the updater (e.g., `sv.value = withTiming(1)` in the callback). This causes infinite loops.
- The callback runs on the JS thread first, then immediately on the UI thread. Use `global._WORKLET` to guard thread-specific code.

### [useAnimatedProps](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedProps)

For animating component properties (not styles). Do all value conversions directly inside the `useAnimatedProps` callback instead of using adapters like `SVGAdapter`:

```tsx
const animatedProps = useAnimatedProps(() => ({
  cx: x.value,
  r: radius.value,
}));
```

Custom color properties require manual `processColor()` wrapping inside the callback.

### [useDerivedValue](https://docs.swmansion.com/react-native-reanimated/docs/core/useDerivedValue)

Creates a read-only shared value that recomputes when its dependencies change. Runs on the UI thread automatically. The `.set()` method is deprecated and will be removed.

If you need access to the previous value, use `useAnimatedReaction` instead.

### [createAnimatedComponent](https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent)

Function components can accept a `ref` prop directly (React 19+). For older React versions, wrap with `React.forwardRef()`. Class components work directly.

Built-in animated components: `Animated.View`, `Animated.Text`, `Animated.Image`, `Animated.ScrollView`, `Animated.FlatList`.

### [useAnimatedRef](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedRef)

The ref value (`current`) is `null` until the component mounts. It is only accessible from the JS thread, so do not read it inside worklets.

---

## Animation Functions

### [withSpring](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring)

Two configuration modes (cannot mix):
- **Physics-based** (stiffness/damping)
- **Duration-based** (duration/dampingRatio)

`dampingRatio` values: `< 1` = underdamped (bouncy), `1` = critically damped (no bounce, fastest settle), `> 1` = overdamped (slow, no bounce).

If both physics-based and duration-based configs are provided, duration-based overrides.

### [withDecay](https://docs.swmansion.com/react-native-reanimated/docs/animations/withDecay)

`clamp` is **required** when `rubberBandEffect` is `true`. The rubber band effect makes the animation bounce at clamp boundaries instead of stopping.

---

## Animation Modifiers

### [withRepeat](https://docs.swmansion.com/react-native-reanimated/docs/animations/withRepeat)

- Non-positive values (`0`, `-1`) repeat infinitely until cancelled or unmounted.
- `reverse: true` creates a ping-pong effect (plays forward, then backward).
- **`reverse` only works with animation functions** (`withSpring`, `withTiming`). It does **not** work with animation modifiers like `withSequence`.

### [withClamp](https://docs.swmansion.com/react-native-reanimated/docs/animations/withClamp)

Limits the animated value range. Designed for `withSpring` to prevent overshoot beyond boundaries. When the spring hits a clamped boundary, its dampingRatio is automatically reduced.

---

## Composition Patterns

Modifiers nest freely:

```tsx
// Staggered entrance
items.forEach((_, i) => {
  sv[i].value = withDelay(i * 100, withSpring(1));
});

// Infinite ping-pong
sv.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);

// Multi-step sequence
sv.value = withSequence(
  withTiming(50, { duration: 200 }),
  withSpring(0),
  withDelay(300, withTiming(100))
);

// Clamped spring
sv.value = withClamp({ min: 0, max: 200 }, withSpring(scrollTarget));
```

### Callback behavior

Callbacks on `withTiming`, `withSpring`, `withDecay`, and `withRepeat` are automatically workletized and run on the UI thread. They receive `(finished: boolean, current: AnimatableValue)` where `finished` is `true` if the animation completed normally, `false` if cancelled.
