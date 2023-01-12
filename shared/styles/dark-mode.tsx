import * as React from 'react'
// The current darkMode story is complex and could be cleaned up.
// Current state: In app/index.native we register for the system events which tell us if the mode changes.
// You can also manually configure to override this. We also inject it on startup in the root index.ios.js files
// This then dispatches to redux so it can be in there so we can drive the settings screens. We recently
// added context which should likely be used instead of isDarkMode (see below)
//
// Individual components can then call Styles.isDarkMode() to get the value. Problem is they need to know that
// that value has changed.
// To solve this at the router level we increment the navKey to cause an entire redraw. This is very
// overkill and causes state to be lost (scroll etc).
// Our Styles.styleSheetCreate takes a function which is called so we can grab the values in both dark and light
// contexts. We have light/dark colors in styles/colors. So to most components that just use a color, they can
// just use a 'magic' color which has two versions.
//
// Now some peculiarities:
// ios: ios actually has native support for the 'magic' colors so we use that. This means we actually don't
// do the navKey thing so we can maintain state and you get native blending when the switch happens.
// But as a side effect if you call isDarkMode() you never know if that changes and you're not redrawn
// so you can get out of sync. The solution to this is to use the Styles.DarkModeContext but that was
// just added.
// One additional note. The animation system does not work with the magic colors so that code will use
// the explicit colors/darkColors and not this magic wrapper
//
// Future work:
// Likely move this all out of redux and into context
export type DarkModePreference = 'system' | 'alwaysDark' | 'alwaysLight'

let darkModePreference: DarkModePreference = 'system'
let systemDarkMode = false
// supports system level changes
let systemSupported = false

// called ONLY from config sagas / mobile boot / remote windows
export const _setDarkModePreference = (pref: DarkModePreference) => {
  darkModePreference = pref
}
// ONLY from system hooks, never call this directly
export const _setSystemIsDarkMode = (dm: boolean) => {
  systemDarkMode = dm
}
export const _setSystemSupported = (supported: boolean) => {
  systemSupported = supported
}

export const isDarkMode = () => {
  switch (darkModePreference) {
    case 'system':
      return systemDarkMode
    case 'alwaysDark':
      return true
    case 'alwaysLight':
      return false
  }
}

export const isDarkModeSystemSupported = () => systemSupported
export const isSystemDarkMode = () => systemDarkMode
export const isDarkModePreference = () => darkModePreference

export const DarkModeContext = React.createContext(isDarkMode())
