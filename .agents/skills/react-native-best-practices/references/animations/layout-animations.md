# Layout Animations

Animations for components entering, exiting, or changing position in the view hierarchy. Reanimated 4, New Architecture required.

For predefined animation lists, modifiers, and parameters, webfetch the linked documentation pages below.

---

## [Entering and Exiting Animations](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations)

Animate elements when they are added to or removed from the view hierarchy:

```tsx
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

{visible && (
  <Animated.View entering={FadeIn} exiting={FadeOut}>
    <Text>Hello</Text>
  </Animated.View>
)}
```

Predefined animation families include Fade, Slide, Zoom, Bounce, Flip, Stretch, Roll, Rotate, LightSpeed, and Pinwheel. Each has directional variants (e.g., `FadeInRight`, `FadeInLeft`, `FadeInUp`, `FadeInDown`).

Chain modifiers on any predefined animation:

```tsx
entering={FadeIn.duration(500).delay(200).springify().damping(15)}
```

Time-based modifiers (`.duration()`, `.easing()`) are incompatible with spring-based modifiers (`.springify()`, `.damping()`, `.mass()`, `.stiffness()`).

### Gotchas

- **`nativeID` conflict (New Architecture)**: Reanimated uses `nativeID` internally for entering animations. Overwriting it breaks the animation. Wrap animated children in a plain `View` to work around this, especially with `TouchableWithoutFeedback`.
- **View flattening**: Removing a non-animated parent triggers exiting animations in its children, but the parent will not wait for children to finish. Add `collapsable={false}` to the parent to prevent this.
- **Spring-based animations**: Not yet available on the web platform.
- **Performance**: Define animation builders outside of components or wrap with `useMemo`.

---

## [Layout Transitions](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-transitions)

Smooth animations when a component's position or size changes due to state updates:

```tsx
import Animated, { LinearTransition } from 'react-native-reanimated';

<Animated.View layout={LinearTransition}>
  {items.map((item) => (
    <Item key={item.id} {...item} />
  ))}
</Animated.View>
```

Predefined transitions: `LinearTransition`, `SequencedTransition`, `FadingTransition`, `JumpingTransition`, `CurvedTransition`, `EntryExitTransition`.

The generic `Layout` transition from older Reanimated versions is deprecated. Use `LinearTransition`.

**Spring config modes**: Use either physics-based (`damping`/`stiffness`) or duration-based (`duration`/`dampingRatio`), never both. If both are provided, duration-based overrides.

---

## [Keyframe Animations](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/keyframe-animations)

For complex multi-step entering/exiting animations beyond what presets offer:

```tsx
import { Keyframe } from 'react-native-reanimated';

const enteringAnimation = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.5 }, { rotate: '-45deg' }] },
  50: {
    opacity: 1,
    transform: [{ scale: 1.2 }, { rotate: '0deg' }],
    easing: Easing.out(Easing.quad),
  },
  100: { transform: [{ scale: 1 }, { rotate: '0deg' }] },
});

<Animated.View entering={enteringAnimation.duration(600)} />
```

### Rules

- Keyframe `0` (or `from`) is **required**. Provide initial values for all properties you intend to animate.
- Keyframe `100` (or `to`) is optional.
- Do not provide both `0` and `from`, or both `100` and `to`.
- Easing is assigned to the second keyframe in a pair. Never provide easing to keyframe `0`.
- Default easing between keyframes is `Easing.linear`.
- **All properties in the transform array must appear in the same order across all keyframes.**

---

## [List Layout Animations](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/list-layout-animations)

Animate item layout changes in `FlatList` when items are added, removed, or reordered:

```tsx
<Animated.FlatList
  data={data}
  renderItem={renderItem}
  itemLayoutAnimation={LinearTransition}
/>
```

### Rules

- Only works with single-column `FlatList`. `numColumns` cannot be greater than 1.
- Items must have a `key` or `id` property (or provide a custom `keyExtractor`).
- Set `itemLayoutAnimation` to `undefined` to disable at runtime.
- Use `.skipEnteringExitingAnimations` to prevent entering/exiting animations on initial mount and unmount of the FlatList.

---

## [LayoutAnimationConfig](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-animation-config)

Skip entering/exiting animations for a subtree:

```tsx
import { LayoutAnimationConfig } from 'react-native-reanimated';

<LayoutAnimationConfig skipEntering skipExiting>
  {children}
</LayoutAnimationConfig>
```

Can be nested. For FlatLists, use the `.skipEnteringExitingAnimations` modifier on `itemLayoutAnimation` instead.

---

## [Shared Element Transitions](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview)

**Status: Experimental. Not recommended for production.**

Animates a view between two screens during navigation:

```tsx
<Animated.Image
  sharedTransitionTag="hero-image"
  sharedTransitionStyle={SharedTransition.duration(550).springify()}
/>
```

- Requires React Navigation native stack navigator. Tab navigator and `transparentModal` (iOS) are not supported.
- Tags must be unique per screen. Add the same tag to matching components on both screens.
- Default duration: 500ms. Animates width, height, position, transform, backgroundColor, opacity.
- iOS supports progress-based (swipe gesture) transitions. Android uses timing-based transitions only.
- Custom animation functions are not yet supported.
