# React Navigation 7.x to 8.x upgrade

## Goal

Upgrade React Navigation to 8.x and handle the required breaking changes.

## Minimum requirements

- Upgrade all `@react-navigation/*` packages together.
- Verify the official minimum versions:
  - `react-native` `>= 0.83`
  - `expo` `>= 55` if you use Expo
  - `typescript` `>= 5.9.2` if you use TypeScript
  - `react-native-screens` `>= 4.20.0`
  - `react-native-safe-area-context` `>= 5.5.0`
  - `react-native-reanimated` `>= 4.0.0`
  - `react-native-web` `>= 0.21.0` if the app targets Web
- Install or update these required packages:
  - `react-native-screens`
  - `react-native-safe-area-context`
  - `react-native-reanimated`
  - `react-native-pager-view` to the latest compatible version
  - `@callstack/liquid-glass`
- If the repo uses Expo, ensure development builds are used. Verify that either `expo-dev-client` is installed or the start workflow uses `expo start --dev-client`.
- If the repo uses TypeScript, set `moduleResolution: 'bundler'` and enable either `strict: true` or `strictNullChecks: true`.

## Areas to review

- Root navigator typing, common hook usage, static screen config objects, and custom navigator typings
- Bottom tabs, custom tab bars, tab headers, and image-based tab icons
- Navigation APIs affected by removed navigator ids, `getParent(id)`, `navigateDeprecated`, `navigationInChildEnabled`, `setParams` with `backBehavior="fullHistory"`, and `getId` behavior changes
- Removed lifecycle and layout props such as detach/freeze options, `Header` layout props, and `getDefaultHeaderHeight`
- Linking and static navigation config, including `prefixes`, `enabled`, `UNSTABLE_router`, and `UNSTABLE_routeNamesChangeBehavior`
- Direct `@react-navigation/elements` usage, removed exports, and direct `Header` rendering

## Required migration steps

### 1. Update dependencies and environment

- Upgrade all `@react-navigation/*` packages together.
- Install or update the required peer packages listed above.
- If the repo uses Expo, ensure development builds are used by installing `expo-dev-client` or by using `expo start --dev-client` in the start workflow.
- If the repo uses TypeScript, update `tsconfig.json` so it uses `moduleResolution: 'bundler'` and either `strict: true` or `strictNullChecks: true`.

### 2. Rework the TypeScript setup

#### The root type now uses the navigator type

Replace global `RootParamList` registration with module augmentation of `@react-navigation/core`.

Before:

```tsx
type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

After:

```tsx
type RootStackType = typeof RootStack;

declare module '@react-navigation/core' {
  interface RootNavigator extends RootStackType {}
}
```

#### Common hooks no longer accept generics

For static config, pass the screen name instead of a generic:

```tsx
const navigation = useNavigation('Profile');
const route = useRoute('Profile');
const focusedRouteName = useNavigationState(
  'Profile',
  (state) => state.routes[state.index].name
);
```

The screen name can refer to the current screen or a parent screen.

For dynamic config, remove hook generics and use explicit type assertions where navigator-specific typing is still needed:

```tsx
const navigation = useNavigation() as StackNavigationProp<
  RootStackParamList,
  'Profile'
>;

const route = useRoute() as RouteProp<RootStackParamList, 'Profile'>;

const focusedRouteName = useNavigationState(
  (state) => state.routes[state.index].name as keyof RootStackParamList
);
```

#### Use `createXScreen` for object-form static screen configs

If a static screen uses the shorthand form, it can stay as shorthand.

If a static screen config is an object, wrap it with the matching `createXScreen` helper:

```tsx
const Stack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: createNativeStackScreen({
      screen: ProfileScreen,
      options: ({ route }) => ({
        title: `User ${route.params.userId}`,
      }),
    }),
  },
});
```

#### Custom navigators need updated overloads

If the repo defines a custom navigator, update its `createNavigatorFactory` overloads and any local navigator wrapper typings.

### 3. Update navigator behavior and option APIs

#### Native bottom tabs are now the default

`@react-navigation/bottom-tabs/unstable` is gone. Native bottom tabs are now the default implementation on iOS and Android.

Keep the native implementation by default. Use `implementation: 'custom'` only when the existing tab setup uses APIs unsupported by native tabs. For example, if `tabBarLabel` previously rendered custom JSX, switch to `implementation: 'custom'`.

Update the related bottom-tab APIs:

- `tabBarShowLabel` becomes `tabBarLabelVisibilityMode`
  - `'auto'`
  - `'selected'`
  - `'labeled'`
  - `'unlabeled'`
- `tabBarLabel` now only accepts a `string`
- If `tabBarIcon` previously used an image asset and the app stays on native tabs, pass `{ type: 'image', source: ... }`
- `safeAreaInsets` on the navigator is removed
- `insets` and `layout` are removed from custom tab bar props

If a custom tab bar previously used the removed `insets` or `layout` props, replace them with `useSafeAreaInsets` and `useSafeAreaFrame` from `react-native-safe-area-context`.

#### Bottom tabs no longer show a header by default

To preserve the previous behavior, add `headerShown: true`:

```tsx
<Tab.Navigator
  screenOptions={{
    headerShown: true,
  }}
>
```

#### Navigators no longer accept an `id` prop

Replace `navigation.getParent(id)` with the screen name of the navigator screen that previously had that `id`.

Before:

```tsx
<Stack.Navigator id="RootTabs">
```

```tsx
const parent = navigation.getParent('RootTabs');
```

After:

```tsx
<RootStack.Screen name="HomeTabs" component={HomeTabsScreen} />
```

```tsx
const parent = navigation.getParent('HomeTabs');
```

#### `setParams` no longer pushes history in tab and drawer when `backBehavior="fullHistory"`

For screens inside tab or drawer navigators using `backBehavior="fullHistory"`, replace `setParams` with `pushParams` only at call sites that need to keep adding a new history entry. Do not replace `setParams` elsewhere.

Before:

```tsx
navigation.setParams({ filter: 'new' });
```

After:

```tsx
navigation.pushParams({ filter: 'new' });
```

#### `getId` no longer reorders the stack

In 7.x, navigating to an existing route with the same `getId` could move that route instance to the top of the stack. In 8.x, it no longer reorders the stack that way.

If code relied on returning to the existing route instance instead of pushing a new one, rewrite the affected call sites to use `{ pop: true }`.

#### Navigators no longer use `InteractionManager`

Replace `InteractionManager.runAfterInteractions` with navigator transition events:

Before:

```tsx
InteractionManager.runAfterInteractions(() => {
  loadData();
});
```

After:

```tsx
navigation.addListener('transitionEnd', () => {
  loadData();
});
```

#### Color arguments now accept `ColorValue`

If the repo manually annotates React Navigation icon props, header props, or navigation theme colors as `string`, update those annotations to allow `ColorValue`.

#### Layout-related props were removed from several components

Check these cases:

- `layout` on `Header`
- `titleLayout` and `screenLayout` on `HeaderBackButton`
- `layouts.title` and `layouts.leftLabel` in stack `headerStyleInterpolator`
- `layout` in `react-native-tab-view`
- `layout` in `react-native-drawer-layout`

If removed layout-related props were previously used to read header or screen dimensions, replace that usage with `useFrameSize` from `@react-navigation/elements`.

#### `detachInactiveScreens` and `freezeOnBlur` are replaced with `inactiveBehavior`

Remove:

- `detachInactiveScreens`
- `detachPreviousScreen`
- `freezeOnBlur`

Use the new screen option instead:

- `inactiveBehavior: 'pause'`
- `inactiveBehavior: 'unmount'` for stack and native stack only
- `inactiveBehavior: 'none'`

Default behavior is now `pause`.

#### Rename and remove the affected navigator options

Apply these direct updates:

- `headerSearchBarOptions.onChangeText` becomes `onChange`
- `headerBackImage` and `headerBackImageSource` become `headerBackIcon`
- `gestureResponseDistance` in stack now takes a `number`
- `overlayColor` in drawer becomes `overlayStyle`

Examples:

```tsx
headerSearchBarOptions: {
  onChange: (event) => {
    const text = event.nativeEvent.text;
  },
}
```

```tsx
headerBackIcon: {
  type: 'image',
  source: require('./back.png'),
}
```

```tsx
gestureResponseDistance: 50
```

```tsx
overlayStyle: {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
}
```

Remove these native stack options:

- `navigationBarColor`
- `navigationBarTranslucent`
- `statusBarBackgroundColor`
- `statusBarTranslucent`

### 4. Update linking and static navigation config

#### `prefixes` is no longer required

The default is now `['*']`, which matches `http`, `https`, and custom schemes.

This is not a required cleanup. Existing `prefixes` can stay unchanged.

#### Deep linking is enabled by default in static config

This applies only to static `Navigation`, not dynamic `NavigationContainer`.

- If static `Navigation` previously had no `linking` prop, add `linking={{ enabled: false }}`
- If static `Navigation` previously had a `linking` prop without `enabled`, add `enabled: true`
- If `enabled: 'auto'` was present, remove it because it is now the default

#### Router configuration names changed

- Rename `UNSTABLE_routeNamesChangeBehavior` to `routeNamesChangeBehavior`
- If the repo uses `UNSTABLE_router`, rename it to `router` without changing the implementation

### 5. Remove deprecated APIs and update `@react-navigation/elements`

If these deprecated APIs are present, update or remove them:

- Replace `navigateDeprecated(ScreenName, params)` with `navigate(ScreenName, params, { pop: true })`
- `navigation.getId` has no direct replacement; remove the usage and rework the surrounding logic to use screen names or route params instead of navigator ids
- Remove `navigationInChildEnabled` only after migrating navigation actions so they start from a screen in the current or parent navigator

#### `HeaderBackButton` and `DrawerToggleButton` now use `icon`

Before:

```tsx
<HeaderBackButton backImage={require('./back.png')} />
<DrawerToggleButton imageSource={require('./menu.png')} />
```

After:

```tsx
<HeaderBackButton icon={{ type: 'image', source: require('./back.png') }} />
<DrawerToggleButton icon={{ type: 'image', source: require('./menu.png') }} />
```

#### Removed exports from `@react-navigation/elements`

Replace:

- `Background` with `useTheme` plus a normal `View`
- `Screen` with the public components or plain `View` structure that renders the same UI. If it was only being used to render a header, render `Header` directly instead
- `SafeAreaProviderCompat` with `SafeAreaProvider` from `react-native-safe-area-context`
- `MissingIcon` with local placeholder icon code
- `Assets` by removing the preloading code

#### Direct `Header` usage

If the repo renders `Header` directly:

- remove the `layout` prop and any other removed layout-related props that code still passes through
- rename `backImage` to `icon`

#### `getDefaultHeaderHeight` now takes an object

Before:

```tsx
getDefaultHeaderHeight(layout, false, statusBarHeight);
```

After:

```tsx
getDefaultHeaderHeight({
  landscape: false,
  modalPresentation: false,
  topInset: statusBarHeight,
});
```

## Migration order

1. Upgrade React Navigation packages, peer dependencies, and required environment/tooling configuration.
2. Rework the TypeScript setup.
3. Update navigator behavior and option APIs.
4. Update linking and static navigation config.
5. Remove deprecated APIs and update direct `@react-navigation/elements` usage.
6. Run automated checks, then ask the user to complete manual checks.
7. Call out the behavior changes introduced by the migration.

## Behavior changes to note

- Code previously deferred with `InteractionManager.runAfterInteractions` now runs from navigator `transitionEnd` events instead of the old global interaction queue behavior.
- Navigating to an existing route with the same `getId` no longer moves that route instance to the top of the stack. If the previous flow relied on going back to the existing route instead of pushing a new one, it now needs `{ pop: true }`.
- Previously, detach and freeze options could keep unfocused screens mounted or keep their effects alive. Now `inactiveBehavior: 'pause'` can clean up effects or background work when a screen becomes unfocused.
- Previously, native stack Android system bar options could customize or disable those bars through React Navigation. Now those options are removed, so apps must keep edge-to-edge enabled and handle system bars outside React Navigation.

## Automated checks

- Required package versions and peer dependencies are installed, including `react-native-screens`, `react-native-safe-area-context`, `react-native-reanimated`, `react-native-pager-view`, and `@callstack/liquid-glass`.
- Expo repos use a development-build workflow.
- TypeScript repos use `moduleResolution: 'bundler'` and either `strict: true` or `strictNullChecks: true`.
- Global `RootParamList` registration is replaced with `RootNavigator` module augmentation.
- `useNavigation`, `useRoute`, and `useNavigationState` no longer use hook generics.
- Object-form static screen configs use the matching `createXScreen` helper.
- Navigator `id` props are removed, `navigation.getParent(id)` is rewritten, and `navigation.getId` is no longer used.
- Static `Navigation` linking config no longer relies on `enabled: 'auto'`, and explicit `enabled` values preserve the previous behavior where needed.
- Removed APIs and props are gone, including `@react-navigation/bottom-tabs/unstable`, `navigateDeprecated`, `navigationInChildEnabled`, `headerBackImage`, `headerBackImageSource`, `imageSource`, `detachInactiveScreens`, `detachPreviousScreen`, `freezeOnBlur`, `navigationBarColor`, `navigationBarTranslucent`, `statusBarBackgroundColor`, `statusBarTranslucent`, `UNSTABLE_router`, and `UNSTABLE_routeNamesChangeBehavior`.
- Removed `@react-navigation/elements` exports are fully replaced.

## Manual checks

- Do a full UI check across the app’s navigators.
- Verify deep links manually.
- On iOS, verify the app’s styling and navigation UI on both iOS 18 and iOS 26.
- If the app supports Web, verify focus management and keyboard navigation.
