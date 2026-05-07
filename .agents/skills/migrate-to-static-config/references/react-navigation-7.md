# React Navigation 7.x Static Config Migration

Use this file only when `@react-navigation/native` is on `7.x`.

## Goal

Convert React Navigation navigators from JSX-based dynamic setup to static configuration while preserving behavior, typing, and deep links.

## When

1. You are migrating screens to the static API in React Navigation 7.x.
2. The navigator's screen list is static and not built at runtime.
3. The navigator doesn't use dynamic variables or props that are not available in static config.

## Prerequisites

- The project is using React Navigation 7.x.
- The versions of `@react-navigation` packages are up-to-date with the published versions.

## Structure

1. Create a static navigator with `createXNavigator({ screens, groups, ... })`.
2. Each `screens` entry can be a component, a nested static navigator, or a screen config object.
3. `groups` define shared options and conditional rendering using `if`, and contain their own `screens`.
4. Screen config objects accept the same options as the dynamic `Screen` API, plus static-only additions such as `linking` and `if`.
5. When a screen needs a config object, use a plain screen config object.
6. A screen config `linking` can be a string path or an object with `path`, `parse`, `stringify`, and `exact`.

## Workflow

### 1. Identify static candidates

A navigator is a static candidate if all its screens are known at build time. Look for:

- **Convertible**: fixed `<Stack.Screen>` elements, conditional rendering based on auth or feature flags (use `if` hooks), render callbacks passing extra props (use React context), navigators wrapped in providers or components using hooks for navigator-level props (use `.with()`)
- **Not convertible**: screen list built from runtime data such as mapping over an API response, screens added or removed based on values that can't be expressed as a hook returning a boolean.

### 2. Convert navigator JSX to static config

Convert the existing navigator first, then introduce screen config objects only where a screen needs options, listeners, params, IDs, linking, or `if`.

Before:

```tsx
const Stack = createNativeStackNavigator();

function MyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
    </Stack.Navigator>
  );
}
```

After:

```tsx
const MyStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  screens: {
    Home: HomeScreen,
    Profile: {
      screen: ProfileScreen,
      options: { title: 'My Profile' },
    },
  },
});
```

Full screen config shape:

```tsx
const MyStack = createNativeStackNavigator({
  screens: {
    Example: {
      screen: ScreenComponent,
      options: ({ route, navigation, theme }) => ({
        title: route.name,
      }),
      listeners: ({ route, navigation }) => ({
        focus: () => {},
      }),
      initialParams: {},
      getId: ({ params }) => params.id,
      linking: {
        path: 'pattern/:id',
        parse: { id: Number },
        stringify: { id: (value) => String(value) },
        exact: true,
      },
      if: useConditionHook,
      layout: ({ children }) => children,
    },
  },
});
```

Shorthand (component only, no config): `ScreenName: ScreenComponent`

Nested static navigator: `ScreenName: AnotherStaticNavigator`

### 3. Convert nested navigators

Nested dynamic navigators rendered as components become nested config objects.

Before:

```tsx
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
    </Tab.Navigator>
  );
}

function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeTabs} />
    </Stack.Navigator>
  );
}
```

After:

```tsx
const HomeTabs = createBottomTabNavigator({
  screens: {
    Groups: GroupsScreen,
    Chats: ChatsScreen,
  },
});

const RootStack = createNativeStackNavigator({
  screens: {
    Home: HomeTabs,
  },
});
```

### 4. Convert groups

Before:

```tsx
function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Group screenOptions={{ headerStyle: { backgroundColor: 'red' } }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Group>
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
```

After:

```tsx
const RootStack = createNativeStackNavigator({
  groups: {
    Card: {
      screenOptions: { headerStyle: { backgroundColor: 'red' } },
      screens: {
        Home: HomeScreen,
        Profile: ProfileScreen,
      },
    },
    Modal: {
      screenOptions: { presentation: 'modal' },
      screens: {
        Settings: SettingsScreen,
      },
    },
  },
});
```

Top-level `screens` and `screenOptions` handle the default group.

Use `groups` when you need different shared options, conditional groups, grouped linking, or to logically group screens if the dynamic config already had such groups.

### 5. Convert auth flows

To migrate conditional screens from dynamic config, use static `if` hooks. The `if` property takes a user-defined hook that returns a boolean such as `useIsSignedIn` or `useIsSignedOut`.

This prevents navigating to protected screens when signed out and unmounts auth screens after sign-in, so the back button cannot return to them.

If you previously used `navigationKey` to reset a screen when auth state changes, duplicate the screen in both auth groups. The group name is used for the key, so switching groups resets the screen. For example, declare `Help` in both the signed-in and signed-out groups instead of using `navigationKey`.

Loading UI should live outside the navigation tree, meaning outside `<NavigationContainer>` / `<Navigation>`, not in a `Loading` screen or group. Keep `screens` and `groups` for actual navigable routes only.

Use `.with()` for wrappers around a mounted navigator, not for boot or loading gates that should happen before rendering `<Navigation>`.

```tsx
const App = () => {
  const isLoading = useIsLoading();

  if (isLoading) {
    return <SplashScreen />;
  }

  return <Navigation />;
};
```

Before:

```tsx
function App() {
  const isSignedIn = useIsSignedIn();

  return (
    <Stack.Navigator>
      {isSignedIn ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
      <Stack.Screen
        navigationKey={isSignedIn ? 'signed-in' : 'signed-out'}
        name="Help"
        component={HelpScreen}
      />
    </Stack.Navigator>
  );
}
```

After:

```tsx
const RootStack = createNativeStackNavigator({
  groups: {
    SignedIn: {
      if: useIsSignedIn,
      screens: {
        Home: HomeScreen,
        Profile: ProfileScreen,
        Help: HelpScreen,
      },
    },
    SignedOut: {
      if: useIsSignedOut,
      screens: {
        SignIn: SignInScreen,
        SignUp: SignUpScreen,
        Help: HelpScreen,
      },
    },
  },
});
```

### 6. Use `.with()` for wrappers, providers, and dynamic navigator props

If the dynamic navigator is rendered in a component that uses hooks for navigator-level behavior, or has wrappers around the mounted navigator, use `.with()` to provide this wrapper. This applies to navigator-level props such as `initialRouteName`, `backBehavior`, `screenOptions`, and `screenListeners` that are derived dynamically.

#### Wrapping with a provider and dynamic options

Before:

```tsx
function MyStack() {
  const someValue = useSomeHook();

  return (
    <SomeProvider>
      <Stack.Navigator screenOptions={{ title: someValue }}>
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </SomeProvider>
  );
}
```

After:

```tsx
const MyStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
  },
}).with(({ Navigator }) => {
  const someValue = useSomeHook();

  return (
    <SomeProvider>
      <Navigator screenOptions={{ title: someValue }} />
    </SomeProvider>
  );
});
```

#### Per-screen dynamic options via `screenOptions` callback

If each screen has different options, use a `screenOptions` callback and switch on `route.name`.

Before:

```tsx
function MyStack() {
  const getSomething = useSomeHook();

  return (
    <SomeProvider>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: getSomething('First') }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: getSomething('Second') }}
        />
      </Stack.Navigator>
    </SomeProvider>
  );
}
```

After:

```tsx
const MyStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: ProfileScreen,
  },
}).with(({ Navigator }) => {
  const getSomething = useSomeHook();

  return (
    <SomeProvider>
      <Navigator
        screenOptions={({ route }) => {
          switch (route.name) {
            case 'Home':
              return {
                title: getSomething('First'),
              };
            case 'Profile':
              return {
                title: getSomething('Second'),
              };
            default:
              return {};
          }
        }}
      />
    </SomeProvider>
  );
});
```

#### Replacing render callbacks with context

Static screens cannot receive extra props via render callbacks. Move the data to React context and provide it via `.with()`.

Before:

```tsx
<Stack.Screen name="Chat">
  {(props) => <ChatScreen {...props} userToken={token} />}
</Stack.Screen>
```

After:

```tsx
const TokenContext = React.createContext('');

function ChatScreen() {
  const token = React.useContext(TokenContext);

  return <Chat token={token} />;
}

const MyStack = createNativeStackNavigator({
  screens: {
    Chat: ChatScreen,
  },
}).with(({ Navigator }) => {
  const token = useToken();

  return (
    <TokenContext.Provider value={token}>
      <Navigator />
    </TokenContext.Provider>
  );
});
```

### 7. Migrate screen-level linking

Use screen-level `linking` to replace the old root `linking.config.screens` structure.

Omit `linking` on a screen when the default kebab-case path is acceptable. If the path is identical to the auto path such as `Details` to `details`, remove the redundant `linking` entry.

Add `linking` for custom paths or when you need path params with `parse` or `stringify`.

Before:

```tsx
const linking = {
  prefixes: ['https://example.com'],
  config: {
    screens: {
      Home: '',
      Profile: {
        path: 'user/:id',
        parse: { id: Number },
      },
      Settings: 'settings',
    },
  },
};
```

After:

```tsx
const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      linking: '', // explicit root path; omit if this is the first leaf screen or the initialRouteName
    },
    Profile: {
      screen: ProfileScreen,
      linking: {
        path: 'user/:id',
        parse: { id: Number },
      },
    },
    Settings: SettingsScreen,
  },
});
```

Linking paths are auto-generated for leaf screens using kebab-case of the screen name. The first leaf screen, or the `initialRouteName` if set, gets the path `/` unless you set an explicit empty path on another screen.

To control auto-generated linking, pass `enabled` on the root `linking` prop: `enabled: 'auto'` generates paths for all leaf screens, and `enabled: false` disables linking entirely.

If a screen previously had a custom path such as `linking: 'contacts'` and you remove it, the auto path becomes kebab-case of the screen name such as `TabContacts` to `tab-contacts`. This breaks existing URLs and deep links. Keep explicit `linking` when you need to preserve existing paths.

If screens containing navigators have `linking` set to `''` or `'/'`, it is usually redundant and can be removed.

Keep TypeScript param typing on the screen component with `StaticScreenProps`. Screen-level `linking` config is for URL parsing and serialization only.

### 8. Update types

#### Getting navigation and route access

Use `StaticScreenProps` to type the screen's `route` prop.

Use the default `useNavigation()` type provided through the global `ReactNavigation.RootParamList` augmentation for navigator-agnostic navigation calls.

Prefer the screen `route` prop over `useRoute` when available. Use `useNavigationState` separately when you need navigation state.

Before:

```tsx
function ProfileScreen({
  navigation,
  route,
}: NativeStackScreenProps<MyStackParamList, 'Profile'>) {
  const id = route.params.id;
  navigation.navigate('Home');
}
```

After:

```tsx
type ProfileScreenProps = StaticScreenProps<{
  id: string;
}>;

function ProfileScreen({ route }: ProfileScreenProps) {
  const navigation = useNavigation();
  const id = route.params.id;

  navigation.navigate('Home');
}
```

Use `StaticScreenProps` to type the `route` prop. If you need navigator-specific APIs such as `push`, `pop`, `openDrawer`, or `setOptions`, you can manually annotate `useNavigation`, but this is not type-safe and should be kept to a minimum.

If you need a navigator-specific navigation object:

```tsx
type RootStackParamList = StaticParamList<typeof RootStack>;

type ProfileNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Profile'
>;

const navigation = useNavigation<ProfileNavigationProp>();
```

#### Remove manual param lists

Remove all hand-written param-list declarations created only to support dynamic typing.

If a param list is absolutely necessary, derive it from the navigator type:

```tsx
type SomeStackType = typeof SomeStack;
type SomeStackParamList = StaticParamList<SomeStackType>;
```

If a static navigator nests a dynamic navigator, annotate the dynamic navigator screen with `StaticScreenProps<NavigatorScreenParams<...>>` so the nesting is reflected in the root param list.

For the root navigator, keep the single source of truth in the `RootParamList` augmentation shown below.

Avoid circular dependencies by:

- Using `StaticScreenProps` for screen params instead of shared hand-written param lists
- Using the default `useNavigation()` type where possible instead of navigator-specific aliases
- Deleting obsolete shared type files when they become empty

#### Root type augmentation

Place the global `RootParamList` augmentation next to the root static navigator. This is the single source of truth for the default types used by `useNavigation`, `Link`, refs, and related APIs.

```tsx
const RootStack = createNativeStackNavigator({
  screens: {
    // ...
  },
});

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

#### Typing params

Use `StaticScreenProps` to annotate route params, including screens that use `linking`.

A path such as `user/:userId` defines URL parsing and serialization. Keep the TypeScript param type on the screen component with `StaticScreenProps`.

If the params are not strings, use `parse` and `stringify` in the `linking` config:

```tsx
type ArticleScreenProps = StaticScreenProps<{
  date: Date;
}>;

function ArticleScreen({ route }: ArticleScreenProps) {
  return <Article date={route.params.date} />;
}

const RootStack = createNativeStackNavigator({
  screens: {
    Article: {
      screen: ArticleScreen,
      linking: {
        path: 'article/:date',
        parse: {
          date: (date: string) => new Date(date),
        },
        stringify: {
          date: (date: Date) => date.toISOString(),
        },
      },
    },
  },
});
```

The runtime parsing comes from `linking`. The compile-time param type comes from `StaticScreenProps`.

Avoid `any`, non-null assertions, and `as` assertions.

#### Full before/after example

Before:

```tsx
type MyStackParamList = {
  Article: { author: string };
  Albums: undefined;
};

const Stack = createNativeStackNavigator<MyStackParamList>();

function ArticleScreen({
  navigation,
  route,
}: NativeStackScreenProps<MyStackParamList, 'Article'>) {
  return <Button onPress={() => navigation.navigate('Albums')} />;
}

function AlbumsScreen() {
  return <Albums />;
}

export function Example() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Article"
          component={ArticleScreen}
          options={({ route }) => ({ title: route.params.author })}
          initialParams={{ author: 'Gandalf' }}
        />
        <Stack.Screen name="Albums" component={AlbumsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

After:

```tsx
import {
  createStaticNavigation,
  type StaticParamList,
  type StaticScreenProps,
  useNavigation,
} from '@react-navigation/native';

type ArticleScreenProps = StaticScreenProps<{
  author: string;
}>;

function ArticleScreen({ route }: ArticleScreenProps) {
  const navigation = useNavigation();

  return (
    <Button
      title={route.params.author}
      onPress={() => navigation.navigate('Albums')}
    />
  );
}

function AlbumsScreen() {
  return <Albums />;
}

const RootStack = createNativeStackNavigator({
  screens: {
    Article: {
      screen: ArticleScreen,
      options: ({ route }) => ({ title: route.params.author }),
      initialParams: { author: 'Gandalf' },
      linking: 'article/:author',
    },
    Albums: AlbumsScreen,
  },
});

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(RootStack);

export function Example() {
  return <Navigation />;
}
```

### 9. Replace the root container

Replace `NavigationContainer` with `createStaticNavigation(RootStack)` once the root static navigator, screen-level linking, and root typing are in place. Then pass container-level props to the generated `Navigation` component.

Before:

```tsx
const linking = {
  prefixes: ['https://example.com', 'example://'],
  config: {
    screens: {
      Home: '',
      Profile: 'profile/:id',
    },
  },
};

function App() {
  return (
    <NavigationContainer linking={linking} theme={MyTheme}>
      <RootStack />
    </NavigationContainer>
  );
}
```

After:

```tsx
import { createStaticNavigation } from '@react-navigation/native';

const RootStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: {
      screen: ProfileScreen,
      linking: 'profile/:id',
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

function App() {
  return (
    <Navigation
      linking={{
        prefixes: ['https://example.com', 'example://'],
        enabled: 'auto',
      }}
      theme={MyTheme}
    />
  );
}
```

Keep screen path details on individual screens.

The `Navigation` component returned by `createStaticNavigation` cannot take a full `linking.config` object. Put per-screen paths in screen-level `linking`, and use the root `linking` prop only for container-level settings and root-level linking options.

The `Navigation` component accepts `linking`, `theme`, `ref`, `onReady`, `onStateChange`, `onUnhandledAction`, and `documentTitle`.

### 10. Gotchas

#### Module-load timing

Static navigator config is created at module load time, not during component render.

Be careful with:

- `translate(...)`
- context-derived values
- feature-flag values read too early

If the value should resolve later, wrap it in a callback:

```tsx
options: () => ({
  tabBarLabel: translate('tabs:home'),
});
```

## Limitations

- Cannot use React hooks such as `useTheme()` directly in `options` or `listeners` callbacks. Use callback arguments such as `theme` instead. `React.use()` (React 19+) can read context in `options` callbacks but may trigger ESLint warnings.
- The screen list is static. Screens cannot be added or removed at runtime. Use `if` hooks for conditional rendering.
- No render callbacks or extra props on screens. Use React context instead.

## Mixing Static and Dynamic

Apps can combine both APIs when needed:

- When migrating incrementally, start from the root navigator since it drives typing. Keep leaf navigators dynamic until converted. Static navigators nested inside dynamic ones lose many benefits such as type inference and auto linking.
- When a leaf navigator genuinely needs runtime-dynamic screens that `if` cannot express.

## Review

1. No `NativeStackScreenProps`, `BottomTabScreenProps`, or custom screen-prop aliases remain. Use `useNavigation()` for access, the screen `route` prop when available, and `StaticScreenProps` for params.
2. `RootParamList` augmentation in `ReactNavigation` lives next to the root static navigator.
3. `createStaticNavigation` replaces `NavigationContainer`.
4. Root `linking` contains container-level settings such as `prefixes` and `enabled`. Screen paths live in screen-level `linking`.
5. Linking config is present only where custom paths or params are required. Defaults are kebab-case.
6. Every screen with params uses `StaticScreenProps`. Screen-level `linking` is used for URL parsing and serialization.
7. No extra props are passed to screens. React context is used instead.
8. No hand-written param lists remain unless derived via `StaticParamList`.
9. No hooks are called directly in `screenOptions`, `options`, or `listeners` callbacks.
10. Loading or boot UI lives outside `<Navigation>`.
11. No circular type references or obsolete shared type files remain from the old dynamic setup.
