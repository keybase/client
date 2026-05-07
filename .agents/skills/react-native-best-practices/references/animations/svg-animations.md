# SVG Animation Patterns

react-native-svg implements the SVG standard as a React component tree, giving you full control over every element in an SVG — including the ability to animate or dynamically change individual parts. Every SVG element becomes a native view.

---

## Animating SVG Elements with Reanimated

Use `Animated.createAnimatedComponent` to make any SVG element animatable.

Do all value conversions directly inside the `useAnimatedStyle` or `useAnimatedProps` callback. Do **not** use `SVGAdapter` — handle conversions (string formatting, color processing, unit calculations) in place within the callback:

```tsx
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Circle, Svg } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PulsingCircle() {
  const radius = useSharedValue(30);

  radius.value = withRepeat(withTiming(50, { duration: 600 }), -1, true);

  const animatedProps = useAnimatedProps(() => ({
    r: radius.value,
  }));

  return (
    <Svg width={120} height={120}>
      <AnimatedCircle cx={60} cy={60} animatedProps={animatedProps} fill="tomato" />
    </Svg>
  );
}
```

---

## Animating SVG Path (e.g. Progress Arc)

```tsx
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function ProgressArc({ progress }: { progress: number }) {
  const animatedProgress = useSharedValue(0);
  animatedProgress.value = withTiming(progress, { duration: 800 });

  const animatedProps = useAnimatedProps(() => {
    const angle = animatedProgress.value * 2 * Math.PI;
    const x = 60 + 50 * Math.cos(angle - Math.PI / 2);
    const y = 60 + 50 * Math.sin(angle - Math.PI / 2);
    const largeArc = animatedProgress.value > 0.5 ? 1 : 0;
    return {
      d: `M 60 10 A 50 50 0 ${largeArc} 1 ${x} ${y}`,
    };
  });

  return (
    <Svg width={120} height={120}>
      <AnimatedPath animatedProps={animatedProps} stroke="tomato" strokeWidth={4} fill="none" />
    </Svg>
  );
}
```
