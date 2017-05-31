// @flow
import {forceImmediateLogging} from '../local-debug'
import {isAndroid} from '../constants/platform'

function immediateCallback(cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void): number {
  cb({didTimeout: true, timeRemaining: () => 0})
  return 0
}

function timeoutFallback(cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void): number {
  return setTimeout(function() {
    cb({
      didTimeout: true,
      timeRemaining: function() {
        return 0
      },
    })
  }, 20)
}

function cancelIdleCallbackFallback(id: number) {
  clearTimeout(id)
}

// TODO: Re-enable requestIdleCallback for Android once https://github.com/facebook/react-native/issues/9579 is fixed
const useFallback = typeof window === 'undefined' || isAndroid || !window.requestIdleCallback
const requestIdleCallback = forceImmediateLogging
  ? immediateCallback
  : useFallback ? timeoutFallback : window.requestIdleCallback
const cancelIdleCallback = useFallback ? cancelIdleCallbackFallback : window.cancelIdleCallback

const onIdlePromise = (timeout: number = 100) =>
  new Promise(resolve => requestIdleCallback(resolve, {timeout}))

export {requestIdleCallback, cancelIdleCallback, onIdlePromise}
