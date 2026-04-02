# Scroll, Events, and Utilities

Patterns for scroll-driven animations, event-based reactions, frame callbacks, and measurement in Reanimated 4.

For API signatures and parameter details, webfetch the linked documentation pages below.

---

## Scroll-Driven Animations

### [useAnimatedScrollHandler](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler)

Respond to scroll events with multiple handlers:

```tsx
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event, context) => {
    offset.value = event.contentOffset.y;
  },
  onBeginDrag: (event, context) => {
    context.startY = event.contentOffset.y;
  },
  onEndDrag: (event, context) => {
    if (event.contentOffset.y - context.startY > 100) {
      offset.value = withSpring(200);
    }
  },
});

<Animated.ScrollView onScroll={scrollHandler}>
  {children}
</Animated.ScrollView>
```

Available handlers: `onScroll`, `onBeginDrag`, `onEndDrag`, `onMomentumBegin`, `onMomentumEnd`.

The `context` object is shared between all handlers for the same component, letting you pass state across events (e.g., save drag start position in `onBeginDrag`, read it in `onEndDrag`).

Passing a single function instead of an object is treated as `onScroll`.

**Gotchas:**
- Must use `Animated.ScrollView`, not plain `ScrollView`.
- On Web, only `onScroll` fires. Other events are iOS/Android only.

### [useScrollOffset](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useScrollOffset)

Simpler alternative when you only need the scroll position as a shared value:

```tsx
const animatedRef = useAnimatedRef<Animated.ScrollView>();
const scrollOffset = useScrollOffset(animatedRef);

const headerStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollOffset.value, [0, 100], [1, 0]),
}));
```

Automatically detects horizontal or vertical scroll. Works with `ScrollView`, `FlatList`, and `FlashList`. The ref can be changed at runtime.

### [scrollTo](https://docs.swmansion.com/react-native-reanimated/docs/scroll/scrollTo)

Programmatic scrolling from the UI thread:

```tsx
const animatedRef = useAnimatedRef<Animated.ScrollView>();

// In a worklet or useDerivedValue
scrollTo(animatedRef, 0, targetY, true); // (ref, x, y, animated)
```

Can only be called from the UI thread. Wrap with `scheduleOnUI()` when calling from RN-thread event handlers.

---

## Value Mapping Utilities

### [interpolate](https://docs.swmansion.com/react-native-reanimated/docs/utilities/interpolate)

Maps a numeric value from one range to another:

```tsx
const opacity = interpolate(scrollOffset.value, [0, 100, 200], [1, 0.5, 0]);
```

Input values must be in increasing order.

### [interpolateColor](https://docs.swmansion.com/react-native-reanimated/docs/utilities/interpolateColor)

Maps a numeric value to a color, producing smooth color transitions:

```tsx
const color = interpolateColor(progress.value, [0, 1], ['#ff0000', '#0000ff'], 'RGB');
```

Color spaces: `'RGB'` (default), `'HSV'`, `'LAB'` (Oklab, perceptually uniform).

---

## Event Reactions

### [useAnimatedReaction](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useAnimatedReaction)

React to shared value changes with access to both current and previous values:

```tsx
useAnimatedReaction(
  () => Math.floor(scrollOffset.value / PAGE_HEIGHT),
  (currentPage, previousPage) => {
    if (previousPage !== null && currentPage !== previousPage) {
      scheduleOnRN(onPageChanged, currentPage);
    }
  }
);
```

The `prepare` function transforms/filters shared values before comparison. The `react` function fires when the prepared value changes.

**Critical:** Do not mutate the same shared value in `react` that you track in `prepare`. This causes an infinite loop.

Use `prepare` to reduce callback frequency (e.g., `Math.floor()` to react only on whole page changes instead of every pixel).

---

## Frame Callbacks

### [useFrameCallback](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback)

Run logic on every frame (60Hz or 120Hz depending on the device):

```tsx
const frameCallback = useFrameCallback((frameInfo) => {
  progress.value += (frameInfo.timeSincePreviousFrame ?? 0) * speed;
});

// Pause/resume
frameCallback.setActive(false);
frameCallback.setActive(true);
```

- `autostart` (second parameter, default `true`) controls whether the callback begins immediately.
- Always memoize the callback with `useCallback` to avoid recreation on every render.
- Use time deltas (`timeSincePreviousFrame`) for frame-rate-independent animations.

---

## Measurement

### [measure](https://docs.swmansion.com/react-native-reanimated/docs/advanced/measure)

Synchronously get a view's dimensions and position on the UI thread:

```tsx
const animatedRef = useAnimatedRef<Animated.View>();

const animatedStyle = useAnimatedStyle(() => {
  if (!_WORKLET) return {}; // Guard: first evaluation runs on JS thread

  const measurements = measure(animatedRef);
  if (measurements === null) return {};

  return {
    transform: [{ translateY: -measurements.height }],
  };
});
```

Returns `{ x, y, width, height, pageX, pageY }` or `null` if the component is unmounted or off-screen (e.g., recycled FlatList items).

**Rules:**
- Always check for `null` before using measurements.
- In `useAnimatedStyle`, guard with `if (!_WORKLET) return {}` because the first evaluation runs on the JS thread where `measure` is unavailable.
- Wrap with `scheduleOnUI()` when calling from RN-thread event handlers.
- Not available with Remote JS Debugger (use Chrome DevTools).

---

## Device Sensors

[`useAnimatedSensor`](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedSensor) tracks device motion (accelerometer, gyroscope, rotation) for parallax and tilt animations. iOS requires location services enabled. Web requires HTTPS.

---

## Keyboard (Deprecated)

[`useAnimatedKeyboard`](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedKeyboard) is deprecated in Reanimated 4. Use `react-native-keyboard-controller` for keyboard-aware animations.
