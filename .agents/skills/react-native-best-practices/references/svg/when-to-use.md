# When to Use React Native SVG

Use `react-native-svg` when you need **interactive or animated control over individual SVG elements**. For static SVGs, there are better options. For animated vector graphics where you don't need per-element control, consider Lottie or Rive.

## Decision Guide

```
Do you need to animate or interactively control individual parts of the SVG?
│
├── YES → Use react-native-svg + Reanimated
│
└── NO
    │
    ├── Is it an icon from a standard icon set?
    │   └── YES → Use icon fonts (@expo/vector-icons, Font Awesome)
    │
    ├── Is it a static SVG image?
    │   └── YES → Use expo-image (preferred) or react-native-vector-image
    │
    ├── Do you need animated vector graphics without per-element control?
    │   └── YES → Use Lottie or Rive
    │
    └── Do you need complex SVGs with filters?
        ├── Need native filter support → react-native-skia
        └── Can tolerate WebView overhead → WebView (browsers are among the best SVG renderers)
```

## Why prefer alternatives for static SVGs

`react-native-svg` creates a full React component tree and a matching native view hierarchy for every SVG element. None of these are memoized by default. Each native drawing operation redraws everything from scratch with no caching. Components like `SvgXml` and `LocalSvg` parse their input into the same React component tree under the hood, so they carry the same overhead.

For a static SVG from your design team, this means unnecessary reconciliation cost in React and unnecessary native views that only exist to pass props to the drawing layer.

## Alternative Comparison

| Tool | Best for | Key trade-off |
|---|---|---|
| `expo-image` | Static SVG images (delegates to Glide/SDWebImage natively) | Loads async, which can cause blinking on first render. Use preloading to minimize this. No filter support. |
| Icon fonts (`@expo/vector-icons`, Font Awesome) | Icons | Limited to available glyphs in the font. Very performant. |
| `react-native-vector-image` | Static SVGs as native assets (Vector Drawables on Android, PDF on iOS) | Build-time asset generation step required |
| Lottie / Rive | Animated vector graphics | Requires converting assets from SVG to Lottie/Rive format. Better animation performance than SVG. |
| `react-native-skia` | Complex SVGs with filters, Reanimated integration | Each `Canvas` object is heavy. Rendering many small SVGs in separate Canvases degrades performance. Adds to package size. |
| WebView | SVGs with features no other renderer supports | Heavier than native options, but browsers cover the most of the SVG standard |

---
