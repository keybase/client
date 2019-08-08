import {isDarkMode} from './dark-mode'

// Support a closure to enable simple dark mode.
// transform is to allow native styleSheetCreate to convert the object

type FuncOrObject = (() => Object) | Object
type Transform = (o: Object) => Object

const styleSheetCreate = (funcOrObj: FuncOrObject, transform: Transform) => {
  if (typeof funcOrObj === 'function') {
    let lightCached: Object | undefined
    let darkCached: Object | undefined

    const wrapped = {
      get: function(_: unknown, prop: string) {
        if (isDarkMode()) {
          darkCached = darkCached || transform(funcOrObj())
          return darkCached[prop]
        } else {
          lightCached = lightCached || transform(funcOrObj())
          return lightCached[prop]
        }
      },
    }

    return new Proxy({}, wrapped)
  } else {
    if (__DEV__) {
      // TODO turn on to see whats not updated
      // console.log('Darkmode incompatible style passed', funcOrObj)
    }
    return funcOrObj
  }
}

export default styleSheetCreate
