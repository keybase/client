# React Native SVG

For the full component and prop API, webfetch https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md

---

## Setup

### Expo

```bash
npx expo install react-native-svg
```

### React Native CLI

```bash
yarn add react-native-svg
cd ios && pod install
```

---

## Loading SVGs

### Inline components

```tsx
import Svg, { Circle, Rect } from 'react-native-svg';

export default function InlineSvg() {
  return (
    <Svg height="100" width="100" viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="45" stroke="blue" strokeWidth="2.5" fill="green" />
      <Rect x="15" y="15" width="70" height="70" stroke="red" strokeWidth="2" fill="yellow" />
    </Svg>
  );
}
```

### From a remote URI

```tsx
import { SvgUri } from 'react-native-svg';

export default function RemoteSvg() {
  return <SvgUri width="100%" height="100%" uri="https://example.com/image.svg" />;
}
```

If the remote SVG contains CSS in a `<style>` element, use `SvgCssUri` from `react-native-svg/css` instead.

`SvgUri` and `SvgCssUri` support `onError`, `onLoad`, and `fallback` props for error handling:

```tsx
<SvgUri
  uri={uri}
  width="100%"
  height="100%"
  onError={() => setUri(fallbackUri)}
  fallback={<FallbackComponent />}
/>
```

### From an XML string

```tsx
import { SvgXml } from 'react-native-svg';

const xml = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red" /></svg>`;

export default function XmlSvg() {
  return <SvgXml xml={xml} width="100%" height="100%" />;
}
```

If the XML string contains CSS in a `<style>` element, use `SvgCss` from `react-native-svg/css` instead.

### Importing `.svg` files directly

Use [react-native-svg-transformer](https://github.com/kristerkari/react-native-svg-transformer) for compile-time conversion with caching.

`metro.config.js` (react-native >= 0.72):

```js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
```

Then import and use SVG files as components:

```tsx
import Logo from './logo.svg';

<Logo width={120} height={40} />
```

---

## Touch Events

SVG elements support `onPress`, `onPressIn`, `onPressOut`, `onLongPress`, `delayPressIn`, `delayPressOut`, `delayLongPress`, and `disabled`:

```tsx
<Circle
  cx="50%"
  cy="50%"
  r="38%"
  fill="red"
  onPress={() => alert('Pressed circle')}
/>
```

---

## Filters

Filter support is partial on native. The following filters work on all platforms:

- `FeBlend`, `FeComposite`, `FeColorMatrix`, `FeDropShadow`, `FeFlood`, `FeGaussianBlur`, `FeMerge`, `FeOffset`

```tsx
import { FeColorMatrix, Filter, Rect, Svg } from 'react-native-svg';

export default function FilteredRect() {
  return (
    <Svg height="300" width="300">
      <Filter id="desaturate">
        <FeColorMatrix type="saturate" values="0.2" />
      </Filter>
      <Rect x="0" y="0" width="300" height="300" fill="red" filter="url(#desaturate)" />
    </Svg>
  );
}
```

### FilterImage

`FilterImage` applies filters to raster images. Import from `react-native-svg/filter-image`. Filters can be applied via the `filters` prop (array) or via the CSS `filter` style property:

```tsx
import { FilterImage } from 'react-native-svg/filter-image';

<FilterImage
  style={{ width: 200, height: 200, filter: 'saturate(3) grayscale(100%)' }}
  source={require('./photo.jpg')}
/>
```

---

## Performance

- **Every SVG element becomes a native view.** A complex SVG creates a full React component tree and a matching native view hierarchy. None are memoized by default, so every re-render reconciles the entire tree.
- **No drawing cache.** Each native drawing dispatch redraws everything from scratch.
- **`SvgXml` and `LocalSvg` have the same overhead.** They parse SVG content into the same React component tree under the hood. You lose direct control over individual elements without gaining any performance benefit.
- **Memory leaks on iOS.** Dependencies between element props can be deeply nested, and some platform primitives don't support automatic memory management, making leaks hard to track down.
- **For static SVG content, prefer `expo-image` or `react-native-vector-image`** over `react-native-svg`. See `when-to-use.md` for a full comparison.

---

## Known Issues

1. Unable to apply focus point of `RadialGradient` on Android.
2. Unable to animate SVG on Paper (Old Architecture).
3. Many SVG filters are web-only and will show a warning on native.
4. Memory leaks on iOS caused by deeply nested element prop dependencies and platform primitives without automatic memory management.

---

## Tips

- Find SVGs at the [Noun Project](https://thenounproject.com/).
- Create or edit SVGs with [Figma](https://www.figma.com/).
- Optimize SVGs with [SVGOMG](https://jakearchibald.github.io/svgomg/). Keep the `viewBox` attribute for best Android results.
- Convert SVG to React Native components with [SVGR](https://react-svgr.com/playground/?native=true&typescript=true).
