# Testing and Troubleshooting

Jest testing patterns and common issues for React Native Gesture Handler.

For full testing API, webfetch [Testing Guide](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing).
For troubleshooting, webfetch [Troubleshooting Guide](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/troubleshooting).

---

## Jest Setup

Add the RNGH mock to your Jest configuration:

```json
{
  "jest": {
    "preset": "react-native",
    "setupFiles": ["./node_modules/react-native-gesture-handler/jestSetup.js"]
  }
}
```

---

## Testing Gesture Callbacks

Use `fireGestureHandler` to simulate gesture event sequences:

```tsx
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';

// v3 -- test gesture hooks directly with renderHook
test('Pan gesture tracks translation', () => {
  const onActivate = jest.fn();
  const panGesture = renderHook(() =>
    usePanGesture({
      disableReanimated: true,
      onActivate: (e) => onActivate(e),
    })
  ).result.current;

  fireGestureHandler(panGesture, [
    { state: State.BEGAN },
    { state: State.ACTIVE, translationX: 50 },
    { translationX: 100 },
    { state: State.END },
  ]);

  expect(onActivate).toHaveBeenCalledTimes(1);
});
```

### fireGestureHandler Auto-Fill Behavior

- Missing `BEGIN` and `END` events are added automatically
- `oldState` is filled from the previous event's `state`
- Events after the first `ACTIVE` can omit `state` (defaults to `ACTIVE`)
- If the first event has no `state`, `ACTIVE` is assumed
- Handler-specific defaults (e.g., `numberOfTouches`, `x`, `y`) are populated

### getByGestureTestId

Find gestures in rendered components by `testID`:

```tsx
// In component
const tap = useTapGesture({ testID: 'my-tap', onDeactivate: handleTap });

// In test
const gesture = getByGestureTestId('my-tap');
fireGestureHandler(gesture, [{ state: State.ACTIVE }]);
```

The `testID` must be unique across all rendered gestures in the test.

### Disable Reanimated in Tests

Set `disableReanimated: true` when testing gesture callbacks to ensure they run synchronously on the JS thread:

```tsx
const pan = usePanGesture({ disableReanimated: true, onUpdate: handleUpdate });
```

Without this, callbacks run as worklets and may not execute during synchronous test assertions.

---

## Common Issues

### "Multiple instances of Gesture Handler were detected"

Dependencies have installed their own copy of RNGH instead of using the app's version.

**Fix with npm:**
```bash
npm ls react-native-gesture-handler
# Add to package.json:
# "overrides": { "react-native-gesture-handler": "<your-version>" }
npm install
```

**Fix with yarn:**
```bash
yarn why react-native-gesture-handler
# Add to package.json:
# "resolutions": { "react-native-gesture-handler": "<your-version>" }
yarn
```

### Gestures Not Working

1. Verify `GestureHandlerRootView` wraps the component tree
2. Check that gestures and the component share the same root view
3. For modals, add a separate `GestureHandlerRootView` inside the modal
4. Import `ScrollView`/`FlatList` from `react-native-gesture-handler`

### `enabled` Prop Does Not Take Effect Immediately

Changes to `enabled` only apply when a new gesture starts (finger touches screen). Setting `enabled: false` during an ongoing gesture will not cancel it. This is by design.

### Android Gesture Cancellation in Third-Party Components

If gestures stop working inside third-party native components, use `unstable_forceActive` on `GestureHandlerRootView`:

```tsx
<GestureHandlerRootView unstable_forceActive>
  {/* Prevents Android from canceling gestures */}
</GestureHandlerRootView>
```

This prevents Android native views from locking touch event delivery and canceling gesture recognition.

### Native Gesture State Flow Deviations

The Native gesture (`useNativeGesture` / `Gesture.Native()`) may deviate from the standard state flow due to platform-specific accommodations. This is expected behavior when wrapping native touch-handling components.

On web, the Native gesture cannot block scrolling on a `ScrollView` due to platform API constraints.

### Touchables Render Extra Views

Touchable components (`TouchableOpacity`, etc.) render two additional views. Style the outer view with `style` and the inner with `containerStyle`.

### Web: Scroll Not Working with Custom Gestures

Add `touchAction="pan-y"` (or `"pan-x"` for horizontal scroll) to `GestureDetector` on web to allow browser scrolling alongside custom gesture handling.
