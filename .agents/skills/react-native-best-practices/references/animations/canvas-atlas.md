# Atlas: Batched Sprite and Tile Animation

The `Atlas` component renders many instances of the same texture in a single draw call with per-instance transforms. Use it for tile maps, sprite animations, and any scene with hundreds of similar objects.

Combine with `useTexture` (creates the texture on the UI thread) and `useRSXformBuffer` (efficiently animates per-sprite transforms in a worklet):

```tsx
import {
  Skia,
  Canvas,
  Atlas,
  Rect,
  Group,
  rect,
  useTexture,
  useRSXformBuffer,
} from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const size = { width: 25, height: 11.25 };
const strokeWidth = 2;
const textureSize = {
  width: size.width + strokeWidth,
  height: size.height + strokeWidth,
};

export const SpriteGrid = () => {
  const pos = useSharedValue({ x: 0, y: 0 });
  const texture = useTexture(
    <Group>
      <Rect
        rect={rect(strokeWidth / 2, strokeWidth / 2, size.width, size.height)}
        color="cyan"
      />
      <Rect
        rect={rect(strokeWidth / 2, strokeWidth / 2, size.width, size.height)}
        color="blue"
        style="stroke"
        strokeWidth={strokeWidth}
      />
    </Group>,
    textureSize
  );

  const gesture = Gesture.Pan().onChange((e) => (pos.value = e));
  const count = 150;
  const gridWidth = 256;

  const sprites = new Array(count)
    .fill(0)
    .map(() => rect(0, 0, textureSize.width, textureSize.height));

  const transforms = useRSXformBuffer(count, (val, i) => {
    'worklet';
    const tx = 5 + ((i * size.width) % gridWidth);
    const ty = 25 + Math.floor(i / (gridWidth / size.width)) * size.width;
    const r = Math.atan2(pos.value.y - ty, pos.value.x - tx);
    val.set(Math.cos(r), Math.sin(r), tx, ty);
  });

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ flex: 1 }}>
        <Atlas image={texture} sprites={sprites} transforms={transforms} />
      </Canvas>
    </GestureDetector>
  );
};
```

## RSXform

Atlas transforms use a compressed rotation-scale-translate matrix `[scos, ssin, tx, ty]`:

```tsx
// Identity (no transform)
Skia.RSXform(1, 0, 0, 0);

// Scale by 2, translate to (50, 100)
Skia.RSXform(2, 0, 50, 100);

// Rotate by PI/4, translate to (50, 100)
const r = Math.PI / 4;
Skia.RSXform(Math.cos(r), Math.sin(r), 50, 100);

// Scale by 2, rotate by PI/4 with pivot (25, 25)
Skia.RSXformFromRadians(2, r, 0, 0, 25, 25);
```
