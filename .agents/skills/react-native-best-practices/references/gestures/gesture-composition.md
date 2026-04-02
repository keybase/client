# Gesture Composition

Patterns for combining multiple gestures on the same component and across components. For the full composition API, webfetch [Gesture Composition](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/gesture-composition).

In v2, all gestures and compositions must be wrapped in `useMemo`.

---

## Same-Component Composition

When multiple gestures attach to the same `GestureDetector`:

```tsx
// SIMULTANEOUS -- both active at once (e.g., pinch + pan for photo viewer)
// v3
const composed = useSimultaneousGestures(pan, pinch);
// v2
const composed = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);

// COMPETING -- first to activate wins, cancels others (e.g., pan vs long press)
// v3
const composed = useCompetingGestures(pan, longPress);
// v2
const composed = useMemo(() => Gesture.Race(pan, longPress), [pan, longPress]);

// EXCLUSIVE -- priority order; later gestures activate only after earlier ones fail
// v3
const composed = useExclusiveGestures(doubleTap, singleTap);
// v2
const composed = useMemo(() => Gesture.Exclusive(doubleTap, singleTap), [doubleTap, singleTap]);
```

**Do not reuse the same gesture instance across multiple GestureDetectors** -- this causes undefined behavior. Create separate gesture instances for each detector.

---

## Cross-Component Relations

For gestures on different components that need to interact. Both components must share the same `GestureHandlerRootView` ancestor.

```tsx
// v3 property names          | v2 builder method names
// .simultaneousWith(other)   | .simultaneousWithExternalGesture(other)
// .requireToFail(other)      | .requireExternalGestureToFail(other)
// .block(other)              | .blocksExternalGesture(other)
```

### simultaneousWith

Both gestures recognize at the same time. Use for nested views where both should respond:

```tsx
// v3
const outerTap = useTapGesture({
  simultaneousWith: innerTap,
  onDeactivate: () => { console.log('outer'); },
});
const innerTap = useTapGesture({
  simultaneousWith: outerTap,
  onDeactivate: () => { console.log('inner'); },
});

// v2
const innerTap = useMemo(() => Gesture.Tap().onEnd(() => { ... }), []);
const outerTap = useMemo(() =>
  Gesture.Tap()
    .simultaneousWithExternalGesture(innerTap)
    .onEnd(() => { ... }),
[innerTap]);
```

### requireToFail

Delay activation until the referenced gesture fails. Use for nested single-tap / double-tap across components:

```tsx
// v3
const singleTap = useTapGesture({
  requireToFail: doubleTap,
  onDeactivate: () => { /* fires only after double-tap timeout */ },
});
const doubleTap = useTapGesture({
  numberOfTaps: 2,
  onDeactivate: () => { ... },
});
```

### block

Prevent referenced gestures from activating while this one is active. Use for ScrollView with pinchable items -- block scroll while pinching:

```tsx
// v3
const pinch = usePinchGesture({
  block: scrollGesture,
  onUpdate: (e) => { ... },
});
```

---

## Pan Inside ScrollView

The most common cross-component scenario. Create a Native gesture for the ScrollView and compose it simultaneously with the Pan:

```tsx
// v2
const scrollRef = useRef(null);
const nativeScroll = useMemo(() => Gesture.Native().withRef(scrollRef), []);
const pan = useMemo(() =>
  Gesture.Pan()
    .simultaneousWithExternalGesture(nativeScroll)
    .onUpdate((e) => { offsetX.value = e.translationX; }),
[nativeScroll]);
const composed = useMemo(() =>
  Gesture.Simultaneous(pan, nativeScroll), [pan, nativeScroll]);

<ScrollView ref={scrollRef}>
  <GestureDetector gesture={composed}>
    <Animated.View style={animatedStyle} />
  </GestureDetector>
</ScrollView>
```

For horizontal pan inside vertical ScrollView, use `activeOffsetX` and `failOffsetY` on the Pan to disambiguate:

```tsx
const pan = useMemo(() =>
  Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .simultaneousWithExternalGesture(nativeScroll)
    .onUpdate((e) => { ... }),
[nativeScroll]);
```

---

## Virtual Gesture Detectors (v3)

`GestureDetector` in v3 is a standalone host component that can break view hierarchies for components like SVG, Text, or custom native views. Use `InterceptingGestureDetector` + `VirtualGestureDetector` to attach gestures without disrupting the hierarchy:

```tsx
import {
  InterceptingGestureDetector,
  VirtualGestureDetector,
} from 'react-native-gesture-handler';

// SVG example
<InterceptingGestureDetector gesture={containerTap}>
  <Svg height="250" width="250">
    <VirtualGestureDetector gesture={circleTap}>
      <Circle cx="125" cy="125" r="125" fill="#001A72" />
    </VirtualGestureDetector>
  </Svg>
</InterceptingGestureDetector>

// Text example -- attach gestures to specific words
<InterceptingGestureDetector>
  <Text>
    Click on{' '}
    <VirtualGestureDetector gesture={linkTap}>
      <Text style={styles.link}>this link</Text>
    </VirtualGestureDetector>
  </Text>
</InterceptingGestureDetector>
```

Rules:
- `VirtualGestureDetector` must be a descendant of `InterceptingGestureDetector`
- `InterceptingGestureDetector`'s `gesture` prop is optional (it can serve solely as context)
- `VirtualGestureDetector` with `Animated.event` only works with `useNativeDriver: false`
- Do not nest detectors using different APIs (hook vs builder) -- causes undefined behavior

For full API, webfetch [Gesture Detectors](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/gesture-detectors).

---

## Modals

Gestures inside a React Native `<Modal>` need their own `GestureHandlerRootView` because modals render in a separate native window:

```tsx
<Modal>
  <GestureHandlerRootView style={{ flex: 1 }}>
    {/* gestures work here */}
  </GestureHandlerRootView>
</Modal>
```

All gesture composition and cross-component relations only work between gestures under the same `GestureHandlerRootView`.

---

## `enabled` Prop Timing

Changes to the `enabled` property only take effect when a new gesture starts (finger touches screen). Setting `enabled: false` during an ongoing gesture does not cancel it. This is by design.

---

## Web: touchAction for Scrolling

When implementing custom gesture components inside a `ScrollView` on web, set `touchAction` on `GestureDetector` to allow browser scroll:

```tsx
<GestureDetector gesture={swipe} touchAction="pan-y">
  {/* Allows vertical scrolling while handling horizontal swipe */}
</GestureDetector>
```

`touchAction` is web-only and maps to the CSS `touch-action` property. Supports all CSS touch-action values.
