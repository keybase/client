# Swipeable and Drawer Components

Pre-built gesture components for common interaction patterns. For full API reference, webfetch the linked documentation pages.

---

## [ReanimatedSwipeable](https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable)

Drop-in swipeable list item component built on Reanimated. Use for swipe-to-delete, swipe-to-archive, and swipe-to-reveal-actions patterns.

```tsx
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

function ListItem({ onDelete }: { onDelete: () => void }) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const renderRightActions = (
    progress: SharedValue<number>,
    translation: SharedValue<number>,
  ) => (
    <Animated.View style={[styles.deleteAction, { opacity: progress }]}>
      <Text>Delete</Text>
    </Animated.View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={80}
      overshootFriction={8}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') onDelete();
      }}
    >
      <View style={styles.row}>
        <Text>Swipeable content</Text>
      </View>
    </Swipeable>
  );
}
```

### Best Practices

- Set `overshootFriction` to 8 or higher for native-feeling resistance when pulling beyond the action panel width
- `renderLeftActions` / `renderRightActions` receive `progress` (0 to 1, exceeds 1 on overshoot), `translation` (absolute offset in points), and `swipeableMethods` for programmatic control
- Use `swipeableRef.current.close()` to programmatically close after an action completes
- `leftThreshold` / `rightThreshold` default to half the action panel width -- adjust for larger or smaller action areas
- For nesting inside other gesture containers, use `simultaneousWithExternalGesture`, `requireExternalGestureToFail`, `blocksExternalGesture` props

### Ref Methods

- `close()` -- close with animation
- `openLeft()` / `openRight()` -- open action panel
- `reset()` -- close without animation

---

## [ReanimatedDrawerLayout](https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated-drawer-layout)

Cross-platform drawer (side menu) component. Replacement for React Native's `DrawerLayoutAndroid`.

```tsx
import ReanimatedDrawerLayout from 'react-native-gesture-handler/ReanimatedDrawerLayout';

function App() {
  const drawerRef = useRef<DrawerLayoutMethods>(null);

  return (
    <ReanimatedDrawerLayout
      ref={drawerRef}
      drawerWidth={280}
      drawerType="slide"
      renderNavigationView={(progressAnimatedValue) => (
        <Animated.View style={{ opacity: progressAnimatedValue }}>
          <Text>Menu content</Text>
        </Animated.View>
      )}
    >
      <MainContent onMenuPress={() => drawerRef.current?.openDrawer()} />
    </ReanimatedDrawerLayout>
  );
}
```

### Drawer Types

- `"front"` -- drawer slides over content
- `"back"` -- content slides to reveal drawer beneath
- `"slide"` -- drawer and content move together

### Best Practices

- `drawerLockMode` controls swipe behavior: `"unlocked"` (default), `"locked-closed"`, `"locked-open"`
- `edgeWidth` sets how far from the edge the swipe gesture triggers
- `renderNavigationView` receives a `progress` SharedValue (0 = closed, 1 = open) for custom animations
- `children` can be a function receiving an `openValue` SharedValue for content animations based on drawer position
- Ref methods: `openDrawer(options?)` / `closeDrawer(options?)` -- options accept `{ initialVelocity, animationSpeed }`

---

## Custom Swipeable with Pan Gesture

When `ReanimatedSwipeable` does not offer enough control, build your own with a Pan gesture:

```tsx
const translateX = useSharedValue(0);
const startX = useSharedValue(0);

// v3
const pan = usePanGesture({
  activeOffsetX: [-10, 10],
  failOffsetY: [-5, 5],
  onBegin: () => { startX.value = translateX.value; },
  onUpdate: (e) => { translateX.value = startX.value + e.translationX; },
  onDeactivate: (e) => {
    if (e.translationX < -80) {
      translateX.value = withTiming(-ACTIONS_WIDTH);
    } else {
      translateX.value = withSpring(0);
    }
  },
});

// v2
const pan = useMemo(() =>
  Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onBegin(() => { startX.value = translateX.value; })
    .onUpdate((e) => { translateX.value = startX.value + e.translationX; })
    .onEnd((e) => {
      if (e.translationX < -80) {
        translateX.value = withTiming(-ACTIONS_WIDTH);
      } else {
        translateX.value = withSpring(0);
      }
    }),
[]);
```

Use `activeOffsetX`/`failOffsetY` to distinguish horizontal swipe from vertical scroll.

### Web Compatibility

On web, add `touchAction="pan-y"` to `GestureDetector` so browser vertical scrolling works alongside horizontal swipe:

```tsx
<GestureDetector gesture={pan} touchAction="pan-y">
  <Animated.View style={[styles.row, animatedStyle]}>
    {children}
  </Animated.View>
</GestureDetector>
```
