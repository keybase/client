import * as DarkMode from '../constants/darkmode'
import type {StylesCrossPlatform} from '.'

// Support a closure to enable simple dark mode.
// transform is to allow native styleSheetCreate to convert the object

type Transform = (o: MapToStyles) => MapToStyles

type MapToStyles = Record<string, StylesCrossPlatform>

const styleSheetCreate = (f: () => MapToStyles, transform: Transform) => {
  let lightCached: MapToStyles | undefined
  let darkCached: MapToStyles | undefined

  let darkModePrefCached = DarkMode.useDarkModeState.getState().darkModePreference

  const keys = Object.keys(f())
  const sheet = {}

  keys.forEach(key => {
    Object.defineProperty(sheet, key, {
      configurable: false,
      enumerable: true,
      get() {
        // if this changes we should kill our caches
        const darkModePref = DarkMode.useDarkModeState.getState().darkModePreference
        if (darkModePrefCached !== darkModePref) {
          darkModePrefCached = darkModePref
          darkCached = undefined
          lightCached = undefined
        }

        if (DarkMode.useDarkModeState.getState().isDarkMode()) {
          darkCached = darkCached || transform(f())
          return darkCached[key]
        } else {
          lightCached = lightCached || transform(f())
          return lightCached[key]
        }
      },
    })
  })

  return sheet
}

export default styleSheetCreate
