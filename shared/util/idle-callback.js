// @flow
import {isAndroid} from '../constants/platform'

// Uncomment to disable idlecallback
// function requestIdleCallback (cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void): number {
  // cb({didTimeout: false, timeRemaining: () => 0})
  // return 0
// }

// TODO (AW): Re-enable requestIdleCallback for Android once https://github.com/facebook/react-native/issues/9579 is fixed
const requestIdleCallback = (typeof window !== 'undefined' && !isAndroid && window.requestIdleCallback) ||
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

const cancelIdleCallback = (typeof window !== 'undefined' && !isAndroid && window.cancelIdleCallback) ||
  function (id: number) {
    clearTimeout(id)
  }

export {
  requestIdleCallback,
  cancelIdleCallback,
}
