# Canvas Animations with Skia

Canvas-based animations using `@shopify/react-native-skia` with Reanimated. Use when the scene animates more elements than Reanimated can handle with native views (~100 on low-end Android, ~500 on iOS), or when drawing custom 2D graphics (charts, graphs, generative art, sprite sheets) that benefit from rendering to a single canvas surface.

Skia renders everything to one canvas view, avoiding per-view overhead. All elements share the same draw call pipeline, making it efficient for hundreds of animated shapes, paths, or sprites.

For full API details, webfetch the [official documentation](https://shopify.github.io/react-native-skia).

**Version requirements:** `react-native@>=0.79`, `react@>=19`. For `react-native@<=0.78`, use `@shopify/react-native-skia@1.12.4` or below.

```sh
npm install @shopify/react-native-skia
```

With Expo:
```sh
npx expo install @shopify/react-native-skia
```

Bundle size impact: ~6 MB on iOS, ~4 MB on Android, ~2.9 MB on Web.

---

## Reanimated Integration

Skia components accept Reanimated shared values and derived values as props directly. There is no need for `createAnimatedComponent` or `useAnimatedProps`.

```tsx
import { useEffect } from 'react';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export const AnimatedCircles = () => {
  const size = 256;
  const r = useSharedValue(0);
  const c = useDerivedValue(() => size - r.value);

  useEffect(() => {
    r.value = withRepeat(withTiming(size * 0.33, { duration: 1000 }), -1);
  }, [r, size]);

  return (
    <Canvas style={{ flex: 1 }}>
      <Group blendMode="multiply">
        <Circle cx={r} cy={r} r={r} color="cyan" />
        <Circle cx={c} cy={r} r={r} color="magenta" />
        <Circle cx={size / 2} cy={c} r={r} color="yellow" />
      </Group>
    </Canvas>
  );
};
```

### Canvas Size on the UI Thread

Use the `onSize` prop to get the canvas dimensions as a shared value, which updates whenever the canvas resizes:

```tsx
import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import { Canvas, Rect } from '@shopify/react-native-skia';

const Demo = () => {
  const size = useSharedValue({ width: 0, height: 0 });
  const rect = useDerivedValue(() => ({
    x: 0,
    y: 0,
    width: size.value.width,
    height: size.value.height,
  }));

  return (
    <Canvas style={{ flex: 1 }} onSize={size}>
      <Rect color="cyan" rect={rect} />
    </Canvas>
  );
};
```

---

## Color Interpolation

Skia uses a different color storage format from Reanimated. `interpolateColor` from Reanimated will produce incorrect results. Use `interpolateColors` from `@shopify/react-native-skia` instead:

```tsx
import {
  Canvas,
  LinearGradient,
  Fill,
  interpolateColors,
  vec,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';

const startColors = ['rgba(34,193,195,0.4)', 'rgba(63,94,251,1)'];
const endColors = ['rgba(0,212,255,0.4)', 'rgba(252,70,107,1)'];

export const AnimatedGradient = () => {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(startColors.length - 1, { duration: 4000 }),
      -1,
      true
    );
  }, []);

  const gradientColors = useDerivedValue(() => [
    interpolateColors(progress.value, [0, 1], startColors),
    interpolateColors(progress.value, [0, 1], endColors),
  ]);

  return (
    <Canvas style={{ flex: 1 }}>
      <Fill>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={gradientColors}
        />
      </Fill>
    </Canvas>
  );
};
```

---

## Rendering Modes

Skia supports two rendering paradigms. Both use the same `<Canvas>` element and can be combined in a single scene.

### Retained Mode (default)

Declare the scene as a React component tree. Skia converts it into a display list that is efficient to animate with Reanimated. Animating property values has near-zero FFI cost because the display list structure stays the same.

Best for: UI animations, data visualizations, fixed-structure scenes.

### Immediate Mode (Picture API)

Issue drawing commands directly to a canvas on every frame. Use when the number of drawing commands changes dynamically (the number of elements is itself animated).

Best for: games, generative art, particle trails, any scene where entities are created/destroyed per frame.

```tsx
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

const size = 256;
const paint = Skia.Paint();
const recorder = Skia.PictureRecorder();

export const CircleTrail = () => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
  }, [progress]);

  const picture = useDerivedValue(() => {
    'worklet';
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const count = Math.floor(progress.value * 20);
    for (let i = 0; i < count; i++) {
      const r = ((i + 1) / 20) * (size / 2);
      paint.setColor(Skia.Color(`rgba(0, 122, 255, ${(i + 1) / 20})`));
      canvas.drawCircle(size / 2, size / 2, r, paint);
    }
    return recorder.finishRecordingAsPicture();
  });

  return (
    <Canvas style={{ flex: 1 }}>
      <Picture picture={picture} />
    </Canvas>
  );
};
```

`Picture` does not inherit Group paint properties. Apply effects using the `layer` property on a parent `Group` instead.

---

## Atlas: Batched Sprite and Tile Animation

For `Atlas` batched sprite and tile animations (`useTexture`, `useRSXformBuffer`, RSXform matrix format), read `canvas-atlas.md`.

---

## Path Animations

Skia provides hooks for efficient path animation on the UI thread. For full API details, webfetch the [hooks documentation](https://shopify.github.io/react-native-skia/docs/animations/hooks).

### usePathInterpolation

Interpolates between path shapes based on a progress value. All paths must contain the same number and types of commands for proper interpolation. For paths with different structures, use the [flubber library](https://github.com/veltman/flubber) to generate compatible intermediate paths.

```tsx
import { useEffect } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { Skia, usePathInterpolation, Canvas, Path } from '@shopify/react-native-skia';

const angry = Skia.Path.MakeFromSVGString('M 16 25 C 32 27 ...')!;
const normal = Skia.Path.MakeFromSVGString('M 21 31 C 31 32 ...')!;
const happy = Skia.Path.MakeFromSVGString('M 21 45 C 21 37 ...')!;

const MorphingFace = () => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 1000 });
  }, []);

  const path = usePathInterpolation(progress, [0, 0.5, 1], [angry, normal, happy]);

  return (
    <Canvas style={{ flex: 1 }}>
      <Path path={path} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" />
    </Canvas>
  );
};
```

### usePathValue

Animates a path using imperative commands inside a worklet. Supports 3D transforms via `processTransform3d`:

```tsx
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePathValue, Canvas, Path, processTransform3d, Skia } from '@shopify/react-native-skia';

const rrct = Skia.Path.Make();
rrct.addRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, 100, 100), 10, 10));

export const Card3D = () => {
  const rotateY = useSharedValue(0);
  const gesture = Gesture.Pan().onChange((e) => {
    rotateY.value -= e.changeX / 300;
  });

  const clip = usePathValue((path) => {
    'worklet';
    path.transform(
      processTransform3d([
        { translate: [50, 50] },
        { perspective: 300 },
        { rotateY: rotateY.value },
        { translate: [-50, -50] },
      ])
    );
  }, rrct);

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ flex: 1 }}>
        <Path path={clip} />
      </Canvas>
    </GestureDetector>
  );
};
```

### useClock

Returns a continuously incrementing shared value (milliseconds since activation). Useful for parametric/time-based animations:

```tsx
import { Canvas, useClock, vec, Circle } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

export default function Lissajous() {
  const t = useClock();

  const transform = useDerivedValue(() => {
    const scale = (2 / (3 - Math.cos(2 * t.value))) * 200;
    return [
      { translateX: scale * Math.cos(t.value) },
      { translateY: scale * (Math.sin(2 * t.value) / 2) },
    ];
  });

  return (
    <Canvas style={{ flex: 1 }}>
      <Circle c={vec(0, 0)} r={50} color="cyan" transform={transform} />
    </Canvas>
  );
}
```

---

## Gesture Integration

Wrap the `Canvas` with `GestureDetector` from `react-native-gesture-handler`. Shared values updated in gesture callbacks drive Skia props on the UI thread:

```tsx
import { Canvas, Circle, Fill } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withDecay } from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';

export const DraggableCircle = () => {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(width / 2);

  const gesture = Gesture.Pan()
    .onChange((e) => {
      translateX.value += e.changeX;
    })
    .onEnd((e) => {
      translateX.value = withDecay({
        velocity: e.velocityX,
        clamp: [0, width],
      });
    });

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ flex: 1 }}>
        <Fill color="white" />
        <Circle cx={translateX} cy={40} r={20} color="#3E3E" />
      </Canvas>
    </GestureDetector>
  );
};
```

### Element Tracking

Gestures apply to the entire canvas by default. To target a specific drawn element, overlay an invisible `Animated.View` that mirrors the element's transforms and attach the gesture to that view:

```tsx
import { View } from 'react-native';
import { Canvas, Circle, Fill } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const radius = 30;

export const TrackedCircle = () => {
  const x = useSharedValue(100);
  const y = useSharedValue(100);

  const overlayStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: -radius,
    left: -radius,
    width: radius * 2,
    height: radius * 2,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const gesture = Gesture.Pan().onChange((e) => {
    x.value += e.x;
    y.value += e.y;
  });

  return (
    <View style={{ flex: 1 }}>
      <Canvas style={{ flex: 1 }}>
        <Fill color="white" />
        <Circle cx={x} cy={y} r={radius} color="cyan" />
      </Canvas>
      <GestureDetector gesture={gesture}>
        <Animated.View style={overlayStyle} />
      </GestureDetector>
    </View>
  );
};
```

---

## SKSL Runtime Shaders

Skia provides a shading language (SKSL) similar to GLSL for per-pixel effects. Compile shaders with `Skia.RuntimeEffect.Make` and apply them as children of drawing elements or as image filters.

For full SKSL syntax, webfetch the [shading language docs](https://shopify.github.io/react-native-skia/docs/shaders/overview).

```tsx
import { Canvas, Skia, Shader, Fill } from '@shopify/react-native-skia';

const source = Skia.RuntimeEffect.Make(`
uniform vec2 resolution;
uniform float time;

vec4 main(vec2 pos) {
  vec2 uv = pos / resolution;
  float d = length(uv - 0.5);
  float pulse = 0.5 + 0.5 * sin(d * 20.0 - time * 3.0);
  return vec4(uv.x, pulse, uv.y, 1.0);
}
`)!;

// Pass shared values as uniforms to animate on the UI thread
```

### RuntimeShader Image Filter

Apply SKSL shaders as image filters to existing drawings. The currently filtered image is passed as the `image` uniform:

```tsx
import { Canvas, Skia, Group, Circle, RuntimeShader } from '@shopify/react-native-skia';

const source = Skia.RuntimeEffect.Make(`
uniform shader image;

half4 main(float2 xy) {
  return image.eval(xy).rbga;
}
`)!;

export const FilteredCircle = () => (
  <Canvas style={{ flex: 1 }}>
    <Group>
      <RuntimeShader source={source} />
      <Circle cx={128} cy={128} r={128} color="lightblue" />
    </Group>
  </Canvas>
);
```

`RuntimeShader` does not account for pixel density scaling. For crisp output, apply supersampling: scale up by `PixelRatio.get()` before filtering, then scale back down. See the [RuntimeShader docs](https://shopify.github.io/react-native-skia/docs/image-filters/runtime-shader#pixel-density) for details.

---

## Textures

Create GPU textures on the UI thread for use with `Atlas` or `Image` components.

- **`useTexture`**: Creates a texture from React elements. Returns a shared value.
- **`useImageAsTexture`**: Uploads an image from a source to the GPU.
- **`usePictureAsTexture`**: Creates a texture from an `SkPicture` (imperative API).

For full API, webfetch the [textures docs](https://shopify.github.io/react-native-skia/docs/animations/textures).

---

## Rules

- Use `interpolateColors` from `@shopify/react-native-skia` for color animation. `interpolateColor` from Reanimated uses a different color format and produces incorrect results in Skia.
- All paths passed to `usePathInterpolation` must have the same number and types of commands. Mismatched paths produce undefined interpolation behavior.
- `Picture` and `SVG` components do not inherit `Group` paint properties. Use the `layer` property to apply effects.
- The transform origin in Skia `Group` is the top-left corner, not the center (unlike React Native views). Use the `origin` prop to adjust.
- All rotations in Skia are in radians.
- `Skia.RuntimeEffect.Make` returns `null` if the shader fails to compile. Always check the result.
- Canvas accessibility: the `Canvas` supports the same accessibility properties as a `View`. Make drawn elements accessible by overlaying views on top of the canvas (same pattern as element tracking for gestures).
