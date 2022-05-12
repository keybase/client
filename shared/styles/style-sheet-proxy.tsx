import {isDarkMode, isDarkModePreference} from './dark-mode'

// Support a closure to enable simple dark mode.
// transform is to allow native styleSheetCreate to convert the object

type Transform = (o: any) => any

const styleSheetCreate = (f: () => any, transform: Transform) => {
  let lightCached: any
  let darkCached: any

  let darkModePrefCached = isDarkModePreference()

  const keys = Object.keys(f())
  const sheet = {}

  keys.forEach(key => {
    Object.defineProperty(sheet, key, {
      configurable: false,
      enumerable: true,
      get() {
        // if this changes we should kill our caches
        const darkModePref = isDarkModePreference()
        console.log('aaa proxy ', {key, darkModePref, darkModePrefCached})
        if (darkModePrefCached !== darkModePref) {
          console.log('aaa proxy cache clear')
          darkModePrefCached = darkModePref
          darkCached = undefined
          lightCached = undefined
        }

        if (isDarkMode()) {
          // darkCached = darkCached || transform(f())
          darkCached = transform(f())
          return darkCached[key]
        } else {
          // lightCached = lightCached || transform(f())
          lightCached = transform(f())
          return lightCached[key]
        }
      },
    })
  })

  return sheet
}

export default styleSheetCreate
