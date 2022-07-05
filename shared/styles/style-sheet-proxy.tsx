import {isDarkMode} from './dark-mode'

// Support a closure to enable simple dark mode.
// transform is to allow native styleSheetCreate to convert the object

type FuncOrObject = (() => Object) | Object
type Transform = (o: Object) => Object

const styleSheetCreate = (funcOrObj: FuncOrObject, transform: Transform) => {
  if (typeof funcOrObj === 'function') {
    let lightCached: Object | undefined
    let darkCached: Object | undefined

    const keys = Object.keys(funcOrObj())
    const sheet = {}

    keys.forEach(key => {
      Object.defineProperty(sheet, key, {
        configurable: false,
        enumerable: true,
        get() {
          if (isDarkMode()) {
            darkCached = darkCached || transform(funcOrObj())
            return darkCached[key]
          } else {
            lightCached = lightCached || transform(funcOrObj())
            return lightCached[key]
          }
        },
      })
    })

    return sheet
  } else {
    if (__DEV__) {
      // TODO turn on to see whats not updated
      // console.log('Darkmode incompatible style passed', funcOrObj)
    }
    return funcOrObj
  }
}

export default styleSheetCreate
