# GPU Shader Animations

GPU-accelerated animations using WebGPU shaders in React Native. Use when animation requirements exceed what Reanimated can handle: massive particle counts, fluid/physics simulations, procedural noise, custom shader effects, SDF rendering, or 3D scenes.

Requires React Native 0.81+ and the New Architecture.

**Version requirements:** `react-native-wgpu` requires `react-native-reanimated >= 4.2.1` and `react-native-worklets >= 0.7.2`. Upgrade both before installing if the project uses older versions:

```sh
npm install react-native-reanimated@latest react-native-worklets@latest
npm install react-native-wgpu
```

---

## When to Use GPU Shaders

GPU shaders are the right choice when:
- The effect requires per-pixel computation (noise fields, distortion, blur, glow)
- Physics simulations drive the animation (fluid, cloth, boids flocking, gravity)
- You need signed distance function (SDF) rendering for procedural shapes
- 3D rendering is required (meshes, lighting, skeletal animation via Three.js)
- Animation state is computed from math that benefits from GPU parallelism

For high element counts without per-pixel computation (hundreds of 2D shapes, sprites, tiles), prefer `react-native-skia` with the Atlas API instead (see `canvas-animations.md`). Skia renders to a single canvas with lower setup cost than WebGPU.

Stick with Reanimated when animating standard UI components (opacity, transforms, layout changes) or responding to gestures. GPU shaders render into a `Canvas` element, separate from the React Native view hierarchy.

---

## Setup

### react-native-wgpu

Provides the WebGPU API in React Native using Dawn as the backend.

```sh
npm install react-native-wgpu
```

With Expo:
```sh
npx create-expo-app@latest -e with-webgpu
```

### TypeGPU (recommended)

Type-safe abstraction over WebGPU. Write shader logic in TypeScript that compiles to WGSL.

```sh
npm install typegpu
npm install --save-dev @webgpu/types unplugin-typegpu
```

Add `@webgpu/types` to `tsconfig.json`:

```json
{ "compilerOptions": { "types": ["@webgpu/types"] } }
```

Add the Babel plugin for `'use gpu'` function syntax:

```js
// babel.config.js
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['unplugin-typegpu/babel'],
  };
};
```

Clear Metro cache after adding the plugin: `npx expo --clear`.

Expo Go is not supported. Run `npx expo prebuild` if migrating from Expo Go.

On the iOS simulator, disable Metal Validation in Edit Scheme to avoid crashes.

---

## Canvas and Device Setup

The `Canvas` component provides the WebGPU surface. Use `useDevice` and `useCanvasRef` hooks from `react-native-wgpu`:

```tsx
import { Canvas, useDevice, useCanvasRef } from 'react-native-wgpu';
import tgpu, { d } from 'typegpu';

function GPUScene() {
  const { device = null } = useDevice();
  const ref = useCanvasRef();

  useEffect(() => {
    if (!device) return;

    const context = ref.current!.getContext('webgpu')!;
    const root = tgpu.initFromDevice({ device });
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    // Create pipelines and render here
    // ...
    context.present(); // Required: manually present the frame

    return () => root.destroy();
  }, [device]);

  return <Canvas ref={ref} style={{ flex: 1 }} />;
}
```

### Key differences from Web WebGPU

- **`context.present()`** is required after submitting commands. React Native does not auto-present frames.
- Canvas size uses device pixel ratio: `canvas.width = canvas.clientWidth * PixelRatio.get()`.
- On Android, `alphaMode` is ignored in `context.configure()`. Use the `transparent` prop on `Canvas` instead.

---

## Reanimated Integration

WebGPU objects (`GPUDevice`, `GPUCanvasContext`) are automatically registered for worklet serialization. You can pass them directly to worklets and run GPU rendering on the UI thread:

```tsx
import { scheduleOnUI } from 'react-native-worklets';

const renderFrame = (device: GPUDevice, context: GPUCanvasContext) => {
  'worklet';
  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      clearValue: [0, 0, 0, 1],
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.end();

  device.queue.submit([commandEncoder.finish()]);
  context.present();
};

// Trigger from RN thread
scheduleOnUI(renderFrame, device, context);
```

This requires `react-native-reanimated` and `react-native-worklets` as peer dependencies:

```sh
npm install react-native-reanimated react-native-worklets
```

Use this pattern to tie GPU rendering to Reanimated shared values or `useFrameCallback` for continuous animation loops.

---

## Render Pipelines with TypeGPU

TypeGPU provides a type-safe API for creating GPU pipelines with TypeScript shader functions.

### Vertex and fragment functions

```tsx
import tgpu, { d } from 'typegpu';

const positions = tgpu.const(d.arrayOf(d.vec2f, 3), [
  d.vec2f(0.0, 0.5),
  d.vec2f(-0.5, -0.5),
  d.vec2f(0.5, -0.5),
]);

const mainVertex = tgpu.vertexFn({
  in: { vertexIndex: d.builtin.vertexIndex },
  out: { pos: d.builtin.position, uv: d.vec2f },
})(({ vertexIndex }) => {
  'use gpu';
  return {
    pos: d.vec4f(positions.$[vertexIndex], 0, 1),
    uv: positions.$[vertexIndex],
  };
});

const mainFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  'use gpu';
  return d.vec4f(uv.x, uv.y, 0.5, 1);
});
```

### Creating and executing the pipeline

```tsx
const pipeline = root.createRenderPipeline({
  vertex: mainVertex,
  fragment: mainFragment,
  targets: { format: navigator.gpu.getPreferredCanvasFormat() },
});

pipeline
  .withColorAttachment({ view: context })
  .draw(3);

context.present();
```

---

## Compute Pipelines

Use compute shaders when the animation state (positions, velocities, colors) is computed on the GPU. Write the state to a storage buffer, then read it in a render pipeline.

### Standard compute pipeline

```tsx
const particleBuffer = root.createMutable(
  d.arrayOf(d.vec2f, 1000),
  initialPositions,
);

const updateParticles = tgpu.computeFn({
  workgroupSize: [64],
  in: { gid: d.builtin.globalInvocationId },
})(({ gid }) => {
  'use gpu';
  const idx = gid.x;
  particleBuffer.$[idx] = particleBuffer.$[idx].add(d.vec2f(0.001, 0));
});

root.createComputePipeline({ compute: updateParticles })
  .dispatchWorkgroups(16); // 16 workgroups * 64 threads = 1024 particles
```

### Guarded compute pipeline (simplified)

For simple parallel loops without manual workgroup sizing:

```tsx
const data = root.createMutable(d.arrayOf(d.f32, 512));

root.createGuardedComputePipeline((x) => {
  'use gpu';
  data.$[x] = data.$[x] * 2;
}).dispatchThreads(512);
```

Think of `dispatchThreads(n)` as a parallelized `for (let i = 0; i < n; i++)` that runs on the GPU.

---

## Common Animation Patterns

### Particle system

Define particle state as a struct, update positions in a compute shader each frame, render as instanced geometry:

```tsx
const Particle = d.struct({
  position: d.vec2f,
  velocity: d.vec2f,
  life: d.f32,
});

const particles = root.createMutable(
  d.arrayOf(Particle, 10000),
  initialData,
);

const time = root.createUniform(d.f32);

// Compute: update state
const updateCompute = tgpu.computeFn({
  workgroupSize: [256],
  in: { gid: d.builtin.globalInvocationId },
})(({ gid }) => {
  'use gpu';
  const i = gid.x;
  const p = particles.$[i];
  particles.$[i].position = p.position.add(p.velocity.mul(time.$));
  particles.$[i].life = p.life - 0.01;
});

// Render: draw each particle as instanced geometry
// Vertex shader reads from particles buffer via instance index
```

### Procedural noise effects

Use `@typegpu/noise` for Perlin noise, random distributions, and procedural generation:

```sh
npm install @typegpu/noise
```

```tsx
import { perlin2d, randf } from '@typegpu/noise';

const noiseFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  'use gpu';
  const noise = perlin2d.sample(uv.mul(10));
  return d.vec4f(noise, noise, noise, 1);
});
```

For better performance on large textures, precompute gradients with a static or dynamic cache:

```tsx
const cache = perlin3d.staticCache({ root, size: d.vec3u(64, 64, 1) });

const pipeline = root
  .pipe(cache.inject())
  .createRenderPipeline({ /* ... */ });
```

Caching provides up to 10x performance improvement over on-demand gradient computation.

Available from `@typegpu/noise`:
- **PRNG**: `randf.sample()`, `randf.seed2()` for per-thread seeding
- **Distributions**: `exponential`, `normal`, `cauchy`, `bernoulli`
- **Geometric**: `inUnitCircle`, `onUnitSphere`, `inHemisphere`, and more
- **Perlin noise**: `perlin2d.sample()`, `perlin3d.sample()` with optional caching

### SDF rendering

Use `@typegpu/sdf` for procedural shape rendering and ray marching:

```sh
npm install @typegpu/sdf
```

```tsx
import * as sdf from '@typegpu/sdf';

const sdfFragment = tgpu.fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  'use gpu';
  const centered = uv.sub(0.5);
  const dist = sdf.sdDisk(centered, 0.25);
  if (dist < 0) {
    return d.vec4f(0.2, 0.6, 1.0, 1);
  }
  return d.vec4f(0, 0, 0, 1);
});
```

Shapes are positioned at origin. Apply inverse transforms to the point for translation, rotation, and scale.

### Boids / flocking simulation

A classic GPU compute pattern: each boid reads neighbors from a storage buffer in the compute pass, updates its velocity, then renders as instanced triangles.

### Fluid simulation

Grid-based velocity field stored in a storage buffer or texture. Compute passes handle advection, pressure solving, and diffusion. Render the velocity field as colors or displace geometry.

---

## Three.js and React Three Fiber

For 3D scenes, react-native-wgpu supports Three.js (from r168+) and React Three Fiber:

1. Modify Metro config to resolve Three.js to the WebGPU build.
2. Patch `@react-three/fiber/package.json` to use the WebGPU entry point instead of the React Native bundle:

```diff
-  "react-native": "native/dist/react-three-fiber-native.cjs.js",
+  "react-native": "dist/react-three-fiber.cjs.js",
```

This enables skeletal animation, cloth simulation, particle effects, and complex 3D scene graphs using the Three.js ecosystem.

---

## Performance Notes

- GPU compute runs thousands of threads in parallel with zero JS overhead.
- Frame presentation is manual (`context.present()`). You control timing.
- TypeGPU pipelines are created lazily on first execution, avoiding upfront compilation cost.
- Use `root.unwrap()` to access raw WebGPU resources when needed for interop.
- Timestamp queries (`withPerformanceCallback`) provide nanosecond-precision GPU timing for profiling.
- TypeGPU and raw WebGPU can be mixed freely. Adoption is non-contagious: use TypeGPU where type safety helps and raw WebGPU everywhere else.
