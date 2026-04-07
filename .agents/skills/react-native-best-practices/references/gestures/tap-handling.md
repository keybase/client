# Tap Handling

Patterns for tappable elements in React Native using Gesture Handler. For the full Tap gesture API, webfetch [useTapGesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-tap-gesture) (v3) or [Gesture.Tap](https://docs.swmansion.com/react-native-gesture-handler/docs/legacy-gestures/tap-gesture) (v2).

---

## Decision Matrix

| What to use | When |
|---|---|
| [RectButton](https://docs.swmansion.com/react-native-gesture-handler/docs/components/buttons) | Inside ScrollView / FlatList -- native feel, no highlight on scroll start |
| RectButton + GestureDetector(Tap) | Inside ScrollView / FlatList + need UI-thread animation on press |
| Tap gesture (`useTapGesture` / `Gesture.Tap()`) | Custom animation, multi-tap, double-tap, or programmatic control |
| [RNGH Pressable](https://docs.swmansion.com/react-native-gesture-handler/docs/components/pressable) | Outside scroll containers, drop-in replacement for RN Pressable |
| RN Pressable / TouchableOpacity | Avoid -- conflicts with RNGH, causes double-tap bugs |

**RectButton vs RNGH Pressable in scroll containers**: Pressable highlights items immediately when scroll starts (poor native feel). RectButton delays highlight until the OS confirms a press, matching platform conventions. Always prefer RectButton inside lists.

**Never mix React Native touch components with RNGH** in the same tree -- causes gesture conflicts. Pick one system per app.

---

## RectButton in Scroll Containers

Import both `RectButton` and the scroll container from `react-native-gesture-handler`. Mixing RNGH buttons with React Native's `ScrollView`/`FlatList` causes gesture conflicts:

```tsx
import { FlatList, RectButton, BorderlessButton } from 'react-native-gesture-handler';

<RectButton onPress={handlePress} style={styles.row}>
  <Text>{item.title}</Text>
  <BorderlessButton onPress={handleDelete}>
    <DeleteIcon />
  </BorderlessButton>
</RectButton>
```

In v3, the original buttons are renamed with a `Legacy` prefix (`LegacyRectButton`, `LegacyBorderlessButton`). The new `RectButton`/`BorderlessButton` use the hook API internally but keep the same props.

### Accessibility

Wrap button children in a `View` with `accessibilityRole="button"` for full platform support. Without this wrapper, iOS renders unselectable buttons and Android blocks accessibility mode interactions.

---

## RectButton + UI Thread Animation

RectButton alone cannot run worklets on the UI thread. Wrap it with GestureDetector + Tap gesture for press animations:

```tsx
const opacity = useSharedValue(1);

// v3
const tap = useTapGesture({
  onBegin: () => { opacity.value = withTiming(0.7); },
  onFinalize: () => { opacity.value = withTiming(1); },
});

// v2
const tap = useMemo(() =>
  Gesture.Tap()
    .onBegin(() => { opacity.value = withTiming(0.7); })
    .onFinalize(() => { opacity.value = withTiming(1); }),
[]);

<GestureDetector gesture={tap}>
  <Animated.View style={{ opacity }}>
    <RectButton onPress={handlePress}>
      <Text>{item.title}</Text>
    </RectButton>
  </Animated.View>
</GestureDetector>
```

---

## Custom Feedback with Tap Gesture

Scale animation on press:

```tsx
// v3
const tap = useTapGesture({
  onBegin: () => { scale.value = withTiming(0.95); },
  onFinalize: () => { scale.value = withTiming(1); },
});

// v2
const tap = useMemo(() =>
  Gesture.Tap()
    .onBegin(() => { scale.value = withTiming(0.95); })
    .onFinalize(() => { scale.value = withTiming(1); }),
[]);
```

Use `onBegin`/`onFinalize` for visual feedback -- `onBegin` fires on finger down (before activation), `onFinalize` fires on finger up regardless of success or failure. This gives immediate feedback that reverses even when the tap is cancelled.

---

## Double-Tap with Single-Tap Fallback

Use exclusive composition to give double-tap priority. Single-tap fires only after double-tap fails (timeout expires):

```tsx
// v3
const doubleTap = useTapGesture({
  numberOfTaps: 2,
  onDeactivate: () => { scheduleOnRN(onDoubleTap); },
});
const singleTap = useTapGesture({
  numberOfTaps: 1,
  onDeactivate: () => { scheduleOnRN(onSingleTap); },
});
const composed = useExclusiveGestures(doubleTap, singleTap);

// v2
const doubleTap = useMemo(() =>
  Gesture.Tap().numberOfTaps(2).onEnd(() => { scheduleOnRN(onDoubleTap); }), []);
const singleTap = useMemo(() =>
  Gesture.Tap().numberOfTaps(1).onEnd(() => { scheduleOnRN(onSingleTap); }), []);
const composed = useMemo(() =>
  Gesture.Exclusive(doubleTap, singleTap), [doubleTap, singleTap]);
```

The first argument (doubleTap) has highest priority. Single-tap activates only after the double-tap's `maxDelay` timeout passes without a second tap.

---

## Hit Slop

Expand the touch target area for small elements (icons, close buttons). Accepts a number (uniform padding) or per-side values:

```tsx
// v3
const tap = useTapGesture({ hitSlop: 20, onDeactivate: () => { ... } });
const tap = useTapGesture({
  hitSlop: { top: 10, bottom: 30, left: 20, right: 20 },
  onDeactivate: () => { ... },
});

// v2
const tap = useMemo(() => Gesture.Tap().hitSlop(20).onEnd(() => { ... }), []);
```

Apple's Human Interface Guidelines recommend a minimum 44pt touch target. Use `hitSlop` to meet this on elements smaller than 44pt.
