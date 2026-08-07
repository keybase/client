import * as React from 'react'
import {DynamicColorIOS, StyleSheet} from 'react-native'
import {colors, darkColors, type ColorNames, type OpaqueColors} from './colors'
import {useDarkModeState} from '@/stores/darkmode'
import type * as CSS from './css'

// A theme is the palette as this platform can best express it. What differs is not the API
// but how many themes exist:
//
//   android  two themes, real color strings. Android views store colors as resolved ints and
//            nothing re-resolves them on a config change, so the only way a flip reaches the
//            screen is for React to render again with different values.
//   ios      one theme of DynamicColorIOS values. UIKit re-resolves those itself on a trait
//            change, so the theme object never has to change.
//   desktop  one theme of css vars. The browser does the swap.
//
// Because iOS and desktop have a single theme, useTheme() there returns a value that never
// changes, the provider never publishes, and nothing re-renders. Android pays for the repaint
// it actually needs and the other two keep their native theming untouched.
// Values keep the per-name opaque brand the raw palettes use, so allow-lists built on top of
// them -- Text's AllowedColors, for one -- still restrict which colors a slot accepts.
export type Theme = {readonly [K in ColorNames]: OpaqueColors[K]}

const names = Object.keys(colors) as Array<ColorNames>

const makeTheme = (get: (name: ColorNames) => string): Theme =>
  names.reduce<Record<string, string>>((t, name) => {
    t[name] = get(name)
    return t
  }, {}) as unknown as Theme

const lightTheme: Theme = isIOS
  ? // DynamicColorIOS returns an OpaqueColorValue, which RN accepts anywhere a color goes
    makeTheme(name => DynamicColorIOS({dark: darkColors[name], light: colors[name]}) as unknown as string)
  : isAndroid
    ? makeTheme(name => colors[name])
    : makeTheme(name => `var(--color-${name})`)

// Only Android ever needs a second theme.
const darkTheme: Theme = isAndroid ? makeTheme(name => darkColors[name]) : lightTheme

const ThemeContext = React.createContext<Theme>(lightTheme)

export const ThemeProvider = (p: {children: React.ReactNode}) => {
  // The selector is constant-false off Android, so the store never notifies there.
  const isDarkMode = useDarkModeState(s => isAndroid && s.isDarkMode())
  return (
    <ThemeContext.Provider value={isDarkMode ? darkTheme : lightTheme}>{p.children}</ThemeContext.Provider>
  )
}

// Reading the theme through context is what makes an Android flip repaint: context consumers
// re-render even when a memo boundary above them would block new props, which prop-passing
// cannot achieve once react-compiler has memoized the tree.
export const useTheme = () => React.useContext(ThemeContext)

// For callers that aren't in a render: react-navigation theme objects, native module props,
// anything building a color outside React. These do not repaint on a flip, so prefer useTheme.
export const getTheme = (): Theme =>
  isAndroid && useDarkModeState.getState().isDarkMode() ? darkTheme : lightTheme

// Derives a value from the theme once per theme and holds onto it. Identity is stable for the
// app's lifetime, so anything downstream that compares by reference keeps short circuiting.
// Off Android there is one theme, so the factory runs exactly once.
export function createThemedValue<T>(f: (theme: Theme) => T): (theme: Theme) => T {
  const cache = new Map<Theme, T>()
  return theme => {
    let v = cache.get(theme)
    if (v === undefined) {
      v = f(theme)
      cache.set(theme, v)
    }
    return v
  }
}

// The hook form, for lookup tables and other non-stylesheet theme-derived values.
export function createThemedHook<T>(f: (theme: Theme) => T): () => T {
  const get = createThemedValue(f)
  return () => get(useTheme())
}

type NamedStyles = Record<string, CSS._StylesCrossPlatform>

// Turns a theme-taking style factory into a hook.
export function createStyleHook<const O extends NamedStyles>(f: (theme: Theme) => O): () => O
export function createStyleHook(f: (theme: Theme) => NamedStyles): () => NamedStyles {
  return createThemedHook(theme => {
    const built = f(theme)
    return isMobile
      ? (StyleSheet.create(built as unknown as Parameters<typeof StyleSheet.create>[0]) as unknown as NamedStyles)
      : built
  })
}
