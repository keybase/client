// @flow
import {forceImmediateLogging} from '../local-debug'
import {animationFriendlyDelay as _animationFriendlyDelay, useFallback} from './idle-callback-platform'

function immediateCallback(
  cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void,
  deadlineOpts?: {timeout: number}
): number {
  cb({didTimeout: true, timeRemaining: () => 0})
  return 0
}

function timeoutFallback(
  cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void,
  deadlineOpts?: {timeout: number}
): number {
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

const requestIdleCallback = forceImmediateLogging
  ? immediateCallback
  : useFallback ? timeoutFallback : window.requestIdleCallback
const cancelIdleCallback = useFallback ? cancelIdleCallbackFallback : window.cancelIdleCallback

const onIdlePromise = (timeout: number = 100) =>
  new Promise(resolve => requestIdleCallback(resolve, {timeout}))

// If there isn't one, lets just use idle
const animationFriendlyDelay =
  _animationFriendlyDelay ||
  (f => {
    requestIdleCallback(f, {timeout: 10})
  })

export {requestIdleCallback, cancelIdleCallback, onIdlePromise, animationFriendlyDelay}
