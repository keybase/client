# Continuous Gesture Patterns

Patterns for pan (drag), pinch (zoom), rotation, long press, fling, and hover using Gesture Handler with Reanimated.

All gestures use `Animated` from `react-native-reanimated`. In v2, all gesture objects must be wrapped in `useMemo`.

For gesture API reference, see the links in **`gestures.md`**.

---

## Pan (Drag)

### Draggable Element

`translationX/Y` resets to 0 at the start of each gesture. Save the current offset in `onBegin` to support repeated drags:

```tsx
const offsetX = useSharedValue(0);
const startX = useSharedValue(0);

// v3
const pan = usePanGesture({
  onBegin: () => { startX.value = offsetX.value; },
  onUpdate: (e) => { offsetX.value = startX.value + e.translationX; },
  onDeactivate: () => { offsetX.value = withSpring(0); },
});

// v2
const pan = useMemo(() =>
  Gesture.Pan()
    .onBegin(() => { startX.value = offsetX.value; })
    .onUpdate((e) => { offsetX.value = startX.value + e.translationX; })
    .onEnd(() => { offsetX.value = withSpring(0); }),
[]);
```

**Alternative with `changeX`** (v3): Use incremental deltas instead of absolute translation. Simpler when accumulating position:

```tsx
const pan = usePanGesture({
  onUpdate: (e) => { offsetX.value += e.changeX; },
  onDeactivate: () => { offsetX.value = withSpring(0); },
});
```

In v2, `changeX`/`changeY` are available through `.onChange()` instead of `.onUpdate()`.

### Fling with Decay

Continue movement with momentum after the user lifts their finger. `withDecay` takes the gesture's velocity and decelerates:

```tsx
// v3
const pan = usePanGesture({
  onBegin: () => { startX.value = offsetX.value; },
  onUpdate: (e) => { offsetX.value = startX.value + e.translationX; },
  onDeactivate: (e) => {
    offsetX.value = withDecay({ velocity: e.velocityX, clamp: [0, maxX] });
  },
});

// v2
const pan = useMemo(() =>
  Gesture.Pan()
    .onBegin(() => { startX.value = offsetX.value; })
    .onUpdate((e) => { offsetX.value = startX.value + e.translationX; })
    .onEnd((e) => {
      offsetX.value = withDecay({ velocity: e.velocityX, clamp: [0, maxX] });
    }),
[]);
```

`clamp` is required when using `rubberBandEffect: true`. The rubber band effect makes the animation bounce at clamp boundaries instead of stopping.

### Direction Lock

Restrict pan to horizontal or vertical using `activeOffsetX`/`activeOffsetY` and `failOffsetX`/`failOffsetY`:

```tsx
// Horizontal-only pan: activates on 10pt horizontal movement, fails on 5pt vertical
// v3
const horizontalPan = usePanGesture({
  activeOffsetX: [-10, 10],
  failOffsetY: [-5, 5],
  onUpdate: (e) => { offsetX.value += e.changeX; },
});

// v2
const horizontalPan = useMemo(() =>
  Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onChange((e) => { offsetX.value += e.changeX; }),
[]);
```

### Multi-Touch Pan

iOS defaults to tracking the center of mass of all fingers. Android tracks the most recently placed finger. Set `averageTouches: true` on Android for consistent cross-platform behavior:

```tsx
// v3
const pan = usePanGesture({ averageTouches: true, onUpdate: ... });

// v2
const pan = useMemo(() => Gesture.Pan().averageTouches(true).onUpdate(...), []);
```

---

## Pinch (Zoom)

`e.scale` resets to 1 at the start of each gesture. Multiply by saved scale to accumulate across gestures:

```tsx
const scale = useSharedValue(1);
const savedScale = useSharedValue(1);

// v3
const pinch = usePinchGesture({
  onUpdate: (e) => { scale.value = savedScale.value * e.scale; },
  onDeactivate: () => { savedScale.value = scale.value; },
});

// v2
const pinch = useMemo(() =>
  Gesture.Pinch()
    .onUpdate((e) => { scale.value = savedScale.value * e.scale; })
    .onEnd(() => { savedScale.value = scale.value; }),
[]);
```

**Focal point**: `focalX`/`focalY` give the center point between the two fingers. Use them to zoom toward the pinch center. Only use focal coordinates after the gesture has activated -- using them in `onBegin` produces unexpected results.

### Pinch + Pan (Photo Viewer)

Combine pinch and pan with simultaneous composition for a standard photo viewer:

```tsx
// v3
const pinch = usePinchGesture({ onUpdate: ..., onDeactivate: ... });
const pan = usePanGesture({ onBegin: ..., onUpdate: ... });
const composed = useSimultaneousGestures(pan, pinch);

// v2
const pinch = useMemo(() => Gesture.Pinch().onUpdate(...).onEnd(...), []);
const pan = useMemo(() => Gesture.Pan().onBegin(...).onUpdate(...), []);
const composed = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);
```

Add a rotation gesture for full photo viewer behavior (pinch + pan + rotate simultaneously).

---

## Rotation

`rotation` is in radians and resets to 0 at the start of each gesture. Accumulate across gestures:

```tsx
const rotation = useSharedValue(0);
const savedRotation = useSharedValue(0);

// v3
const rotationGesture = useRotationGesture({
  onUpdate: (e) => { rotation.value = savedRotation.value + e.rotation; },
  onDeactivate: () => { savedRotation.value = rotation.value; },
});

// v2
const rotationGesture = useMemo(() =>
  Gesture.Rotation()
    .onUpdate((e) => { rotation.value = savedRotation.value + e.rotation; })
    .onEnd(() => { savedRotation.value = rotation.value; }),
[]);
```

---

## Long Press

Activates after holding for `minDuration` (default 500ms). Fails if finger moves beyond `maxDistance` (default 10pt) before activation. `shouldCancelWhenOutside` defaults to `true` for long press (unlike most other gestures).

### Long Press Then Drag

Use the Pan gesture's `activateAfterLongPress` instead of combining separate long press and pan gestures:

```tsx
// v3
const pan = usePanGesture({
  activateAfterLongPress: 500,
  onActivate: () => { /* start dragging -- haptic feedback here */ },
  onUpdate: (e) => { offsetY.value += e.changeY; },
  onDeactivate: () => { offsetY.value = withSpring(snapPosition); },
});

// v2
const pan = useMemo(() =>
  Gesture.Pan()
    .activateAfterLongPress(500)
    .onStart(() => { /* start dragging */ })
    .onChange((e) => { offsetY.value += e.changeY; })
    .onEnd(() => { offsetY.value = withSpring(snapPosition); }),
[]);
```

---

## Fling

Detects quick directional movements. Configure with `direction` using the `Directions` flags. Activates upon recognition and ends when the finger is released. Fails if the finger lifts before activation.

```tsx
import { Directions } from 'react-native-gesture-handler';

// v3
const fling = useFlingGesture({
  direction: Directions.RIGHT | Directions.LEFT,
  onDeactivate: () => { scheduleOnRN(handleSwipe); },
});

// v2
const fling = useMemo(() =>
  Gesture.Fling()
    .direction(Directions.RIGHT | Directions.LEFT)
    .onEnd(() => { scheduleOnRN(handleSwipe); }),
[]);
```

For swipe-to-dismiss, combine with `withTiming` or `withSpring` to animate the view off-screen on fling detection.

---

## Hover

Detects mouse or stylus hover over a view. Available on Android, iOS (Apple Pencil / pointer), and Web. For full API, webfetch [useHoverGesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-hover-gesture).

**Do not rely on Hover to continue after the mouse button is clicked or the stylus touches the screen.** Combine with Pan gesture if you need both hover and touch tracking.

```tsx
// v3
const hover = useHoverGesture({
  onActivate: () => { isHovered.value = true; },
  onDeactivate: () => { isHovered.value = false; },
});

// v2
const hover = useMemo(() =>
  Gesture.Hover()
    .onBegin(() => { isHovered.value = true; })
    .onEnd(() => { isHovered.value = false; }),
[]);
```

iOS supports hover visual effects via `effect` config: `HoverEffect.LIFT` or `HoverEffect.HIGHLIGHT`.

Web: use the `activeCursor` property to set CSS cursor on hover (e.g., `"grab"`, `"pointer"`, `"zoom-in"`).

---

## scheduleOnRN

Use `scheduleOnRN` from `react-native-worklets` to call React state setters from gesture callbacks (which run on the UI thread). `runOnJS` is deprecated in Reanimated 4:

```tsx
import { scheduleOnRN } from 'react-native-worklets';

// v3
const tap = useTapGesture({
  onDeactivate: () => { scheduleOnRN(setState, value); },
});

// v2
const tap = useMemo(() =>
  Gesture.Tap().onEnd(() => { scheduleOnRN(setState, value); }),
[]);
```

Arguments are passed directly (not curried like the deprecated `runOnJS`). Functions passed to `scheduleOnRN` must be defined in JS-thread scope.
