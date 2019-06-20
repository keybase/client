import {isDarkMode} from './dark-mode'

const styleSheetCreate = (funcOrObj: (() => Object) | Object) => {
  if (typeof funcOrObj === 'function') {
    let lightCached = isDarkMode() ? null : funcOrObj()
    let darkCached = isDarkMode() ? funcOrObj() : null

    const wrapped = {
      get: function(target, prop) {
        return isDarkMode() ? darkCached[prop] : lightCached[prop]
      },
    }

    return new Proxy({}, wrapped)
  } else {
    if (__DEV__) {
      console.log('Darkmode incompatible style passed', funcOrObj)
    }
    return funcOrObj
  }
}

export default styleSheetCreate
