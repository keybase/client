# React Navigation 6.x to 7.x upgrade

## Goal

Upgrade React Navigation to 7.x and handle the required breaking changes.

## Minimum requirements

- Upgrade all `@react-navigation/*` packages together.
- Verify the official minimum versions:
  - `react-native` `>= 0.72.0`
  - `expo` `>= 52` if you use Expo Go
  - `typescript` `>= 5.0.0` if you use TypeScript
- Install or update `react-native-screens` to `4.x`.
- If the repo uses `@react-navigation/drawer` on native, install or update `react-native-reanimated` to `3.x` and remove `useLegacyImplementation`.
- If the repo uses TypeScript, set `moduleResolution: 'bundler'` and enable either `strict: true` or `strictNullChecks: true`.

## Areas to review

- Same-stack navigation calls, nested child navigation calls, and route-key navigation
- `NavigationContainer` usage, `NavigationIndependentTree`, custom theme objects, and direct navigation-state mutation
- `Link`, `useLinkProps`, `useLinkBuilder`, and deep-link configuration
- Removed or renamed stack, drawer, bottom-tab, and material-top-tab props
- `unmountOnBlur`, `useLegacyImplementation`, and direct `react-native-tab-view` usage
- Material bottom tabs, devtools, internal package imports, and custom navigator wrappers

## Required migration steps

### 1. Update dependencies and tooling

- Upgrade all `@react-navigation/*` packages together.
- Install or update `react-native-screens` to `4.x`.
- If the repo uses `@react-navigation/drawer` on native, install or update `react-native-reanimated` to `3.x` and remove `useLegacyImplementation`.
- Stop importing internal package files such as `@react-navigation/.../src` or `@react-navigation/.../lib`.
- If the repo patches React Navigation packages, patch the built files under `lib/`.
- If the repo uses TypeScript, set `moduleResolution: 'bundler'` and enable either `strict: true` or `strictNullChecks: true`.
- If the repo uses Webpack, set `resolve.fullySpecified = false`.

### 2. Fix `navigate` call sites first

#### Nested child-screen lookup is no longer implicit

In 6.x, `navigation.navigate('Details')` could jump to a screen inside an already mounted child navigator. In 7.x, make the parent navigator explicit.

Before:

```tsx
navigation.navigate('Details');
```

After:

```tsx
navigation.navigate('Home', {
  screen: 'Details',
  params: { id: 1 },
});
```

Use the actual parent screen name, and keep the child screen params nested under `params`.

Rewrite child-screen navigation call sites so actions start from a screen in the current or parent navigator. Do not add `navigationInChildEnabled`.

#### `navigate` no longer goes back in stacks

For calls that navigate directly to another screen in the same stack navigator, rewrite them to use `{ pop: true }` to preserve the previous behavior.

Before:

```tsx
navigation.navigate('PreviousScreen', { foo: 42 });
```

After:

```tsx
navigation.navigate('PreviousScreen', { foo: 42 }, { pop: true });
```

#### `navigate({ key })` is removed

If the app navigates by route key, define `getId` on the target screen and rewrite the call site to navigate by screen name plus the params that identify that route instance.

Before:

```tsx
navigation.navigate({
  key: 'profile-123',
  name: 'Profile',
  params: { id: '123' },
});
```

After:

```tsx
<Stack.Screen
  name="Profile"
  component={ProfileScreen}
  getId={({ params }) => params.id}
/>

navigation.navigate('Profile', { id: '123' });
```

### 3. Update `NavigationContainer` and theme usage

- `independent` on `NavigationContainer` is removed. Wrap the container in `NavigationIndependentTree` instead.
- Custom theme objects must include the `fonts` property.
- Navigation state is frozen in development mode. If the app mutates navigation state or route objects directly, refactor to use navigation actions or immutable updates instead.

When replacing `independent`, move the isolation boundary outside the container:

```tsx
import { DefaultTheme, NavigationIndependentTree } from '@react-navigation/native';

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    // my stuff
  },
};

<NavigationIndependentTree>
  <NavigationContainer theme={MyTheme}>{/* ... */}</NavigationContainer>
</NavigationIndependentTree>
```

### 4. Update linking APIs

#### `Link` and `useLinkProps` now use `screen` and `params`

The `to` prop is removed. Rewrite `to` to `screen` and `params`, deriving them from the existing linking configuration.

Before:

```tsx
<Link to="/details?foo=42">Go to Details</Link>
const props = useLinkProps({ to: '/details?foo=42' });
```

After:

```tsx
<Link screen="Details" params={{ foo: 42 }}>Go to Details</Link>
const props = useLinkProps({ screen: 'Details', params: { foo: 42 } });
```

#### `useLinkBuilder` now returns an object

If the repo builds custom navigators or custom link helpers, update:

```tsx
const buildHref = useLinkBuilder();
```

to:

```tsx
const { buildHref, buildAction } = useLinkBuilder();
```

### 5. Update navigator and element APIs

#### Stack and native stack

- `headerBackTitleVisible` becomes `headerBackButtonDisplayMode`.
- `headerTruncatedBackTitle` becomes `headerBackTruncatedTitle`.
- `animationEnabled: false` becomes `animation: 'none'` in stack.
- `customAnimationOnGesture` becomes `animationMatchesGesture` in native stack.
- `statusBarColor` becomes `statusBarBackgroundColor` in native stack.

#### Tabs and drawer

- `unmountOnBlur` is removed from bottom tabs and drawer.
- `tabBarTestID` becomes `tabBarButtonTestID` in bottom tabs and material top tabs.
- `sceneContainerStyle` navigator prop becomes the `sceneStyle` screen option in bottom tabs, material top tabs, and drawer.
- Drawer no longer supports `useLegacyImplementation`.
- `@react-navigation/material-top-tabs` no longer requires a separate `react-native-tab-view` install if that package is only used through the navigator.

To preserve the old `unmountOnBlur` behavior, wrap the affected screen content with `UnmountOnBlur`:

```tsx
import { useIsFocused } from '@react-navigation/native';

function UnmountOnBlur({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();

  if (!isFocused) {
    return null;
  }

  return children;
}
```

- If `unmountOnBlur` was previously set per screen, add `UnmountOnBlur` through that screen’s `layout`.
- If `unmountOnBlur` was previously set on the navigator, add `UnmountOnBlur` through the navigator’s `screenLayout`.

#### Header elements

- `headerBackTitleVisible` becomes `headerBackButtonDisplayMode`
  - `true` -> `default`
  - `false` -> `minimal`
- `headerTruncatedBackTitle` becomes `headerBackTruncatedTitle`
- `labelVisible` is removed from `headerLeft` and `HeaderBackButton`. Use `displayMode` instead:
  - show the normal label -> `default`
  - show the generic back label -> `generic`
  - hide the label -> `minimal`

### 6. Remove deprecated 6.x APIs and handle package moves

React Navigation 7 removes the APIs that were already deprecated in 6.x.

#### `@react-navigation/stack`

- `mode` prop is removed. Use `presentation` instead.
- `headerMode` navigator prop is removed. Move the behavior to the supported `headerMode` and `headerShown` options instead.
- `keyboardHandlingEnabled` navigator prop is removed. Use the screen option instead.

#### `@react-navigation/drawer`

- `openByDefault` becomes `defaultStatus`.
- Navigator-level `lazy` becomes the `lazy` screen option.
- `drawerContentOptions` is removed. Map the old keys directly:
  - `drawerPosition` -> `drawerPosition`
  - `drawerType` -> `drawerType`
  - `edgeWidth` -> `swipeEdgeWidth`
  - `hideStatusBar` -> `drawerHideStatusBarOnOpen`
  - `keyboardDismissMode` -> `keyboardDismissMode`
  - `minSwipeDistance` -> `swipeMinDistance`
  - `overlayColor` -> `overlayColor`
  - `statusBarAnimation` -> `drawerStatusBarAnimation`
  - `gestureHandlerProps` -> `configureGestureHandler`

#### `@react-navigation/bottom-tabs`

- Navigator-level `lazy` becomes the `lazy` screen option.
- `tabBarOptions` is removed. Map the old keys directly:
  - `keyboardHidesTabBar` -> `tabBarHideOnKeyboard`
  - `activeTintColor` -> `tabBarActiveTintColor`
  - `inactiveTintColor` -> `tabBarInactiveTintColor`
  - `activeBackgroundColor` -> `tabBarActiveBackgroundColor`
  - `inactiveBackgroundColor` -> `tabBarInactiveBackgroundColor`
  - `allowFontScaling` -> `tabBarAllowFontScaling`
  - `showLabel` -> `tabBarShowLabel`
  - `labelStyle` -> `tabBarLabelStyle`
  - `iconStyle` -> `tabBarIconStyle`
  - `tabStyle` -> `tabBarItemStyle`
  - `labelPosition` and `adaptive` -> `tabBarLabelPosition`
- `tabBarVisible` is removed. Hide the bar with `tabBarStyle: { display: 'none' }`.

#### `@react-navigation/material-top-tabs`

- Navigator-level `swipeEnabled`, `lazy`, `lazyPlaceholder`, and `lazyPreloadDistance` become options instead of navigator props.
- `tabBarOptions` is removed. Map the old keys directly:
  - `renderBadge` -> `tabBarBadge`
  - `renderIndicator` -> `tabBarIndicator`
  - `activeTintColor` -> `tabBarActiveTintColor`
  - `inactiveTintColor` -> `tabBarInactiveTintColor`
  - `pressColor` -> `tabBarPressColor`
  - `pressOpacity` -> `tabBarPressOpacity`
  - `showLabel` -> `tabBarShowLabel`
  - `showIcon` -> `tabBarShowIcon`
  - `allowFontScaling` -> `tabBarAllowFontScaling`
  - `bounces` -> `tabBarBounces`
  - `scrollEnabled` -> `tabBarScrollEnabled`
  - `iconStyle` -> `tabBarIconStyle`
  - `labelStyle` -> `tabBarLabelStyle`
  - `tabStyle` -> `tabBarItemStyle`
  - `indicatorStyle` -> `tabBarIndicatorStyle`
  - `indicatorContainerStyle` -> `tabBarIndicatorContainerStyle`
  - `contentContainerStyle` -> `tabBarContentContainerStyle`
  - `style` -> `tabBarStyle`

#### Package moves and related tooling

- If the repo uses `@react-navigation/material-bottom-tabs`, migrate its imports and package usage to `react-native-paper/react-navigation`.
- Ensure `react-native-paper` `>= 5.15.0` is installed where that navigator is added.
- If the repo used the removed Flipper plugin from `@react-navigation/devtools`, migrate it to `useLogger`.
- If the repo uses `react-native-tab-view` directly, migrate its `TabBar` and route option props to the new `commonOptions` / `options` API, and replace `sceneContainerStyle` with `sceneStyle`.
- Update any custom `createNavigatorFactory` wrappers to match the newer TypeScript requirements.

## Migration order

1. Upgrade React Navigation packages, peer dependencies, and tooling configuration.
2. Fix `navigate` call sites.
3. Update `NavigationContainer` and theme usage.
4. Update linking APIs.
5. Update navigator and element APIs.
6. Remove deprecated APIs and migrate moved packages.
7. Run automated checks, then ask the user to complete manual checks.
8. Call out the behavior changes introduced by the migration.

## Behavior changes to note

- Previously, `onReady` could fire before a navigator was actually rendered. Now it fires only after a navigator is rendered, so apps that conditionally render navigators inside `NavigationContainer` may see it fire later.
- Previously, path params were encoded more aggressively with behavior closer to `encodeURIComponent`. Now only characters that are invalid in the path position are encoded, so deep links containing reserved characters such as `@` can resolve differently.
- Previously, screens pushed on top of modals could still render as normal cards. Now those screens inherit modal presentation, so a flow that used to show a card above a modal may continue rendering as modal screens.
- If the repo used the removed Flipper plugin, navigation debugging now comes from `useLogger` instead of Flipper.

## Automated checks

- Required package versions are installed, including `react-native-screens` `4.x` and `react-native-reanimated` `3.x` where drawer is used.
- TypeScript repos use `moduleResolution: 'bundler'` and either `strict: true` or `strictNullChecks: true`.
- `NavigationContainer` no longer uses `independent`, and any isolated tree uses `NavigationIndependentTree`.
- Custom themes include the `fonts` property.
- No child-screen navigation relies on implicit lookup, and `navigationInChildEnabled` is not added or left behind.
- Same-stack `navigate('Screen', ...)` call sites that need to preserve previous behavior use `{ pop: true }`.
- `navigate({ key })` is removed. Matching screens define `getId`, and the call sites navigate by name plus identifying params instead of route keys.
- `Link` and `useLinkProps` no longer use `to`.
- `useLinkBuilder` is updated to return `{ buildHref, buildAction }`.
- Removed props and APIs are gone, including `useLegacyImplementation`, `unmountOnBlur`, `headerBackTitleVisible`, `headerTruncatedBackTitle`, `animationEnabled`, `customAnimationOnGesture`, `statusBarColor`, `tabBarTestID`, and `sceneContainerStyle`.
- Material bottom tabs imports are migrated if the repo uses that package.
- Internal React Navigation package imports are removed.

## Manual checks

- Do a full UI check across the app’s navigators.
- Verify deep links manually.
