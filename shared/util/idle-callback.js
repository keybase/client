// @flow
import {OS} from '../constants/platform'

// TODO (AW): Re-enable requestIdleCallback for Android once https://github.com/facebook/react-native/issues/9579 is fixed
const requestIdleCallback = (typeof window !== 'undefined' && OS !== 'android' && window.requestIdleCallback) ||
  function (cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void): number {
    var start = Date.now()
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: function () {
          return Math.max(0, 50 - (Date.now() - start))
        },
      })
    }, 1)
  }

const cancelIdleCallback = (typeof window !== 'undefined' && OS !== 'android' && window.cancelIdleCallback) ||
  function (id: number) {
    clearTimeout(id)
  }

export {
  requestIdleCallback,
  cancelIdleCallback,
}
