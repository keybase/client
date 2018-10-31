// @flow
import {forceImmediateLogging} from '../local-debug'

type TimeoutInfo = {didTimeout: boolean, timeRemaining: () => number}

function immediateCallback(cb: (info: TimeoutInfo) => void, deadlineOpts?: {timeout: number}): number {
  cb({didTimeout: true, timeRemaining: () => 0})
  return 0
}

function timeoutFallback(cb: (info: TimeoutInfo) => void, deadlineOpts?: {timeout: number}): TimeoutID {
  return setTimeout(function() {
    cb({
      didTimeout: true,
      timeRemaining: function() {
        return 0
      },
    })
  }, 20)
}

function cancelIdleCallbackFallback(id: TimeoutID) {
  id && clearTimeout(id)
}

const useFallback = typeof window === 'undefined' || !window.requestIdleCallback
const requestIdleCallback = forceImmediateLogging
  ? immediateCallback
  : useFallback
    ? timeoutFallback
    : window.requestIdleCallback.bind(window)
const cancelIdleCallback = useFallback ? cancelIdleCallbackFallback : window.cancelIdleCallback.bind(window)

const onIdlePromise = (timeout: number = 100): Promise<TimeoutInfo> =>
  new Promise(resolve => requestIdleCallback(resolve, {timeout}))

export {requestIdleCallback, cancelIdleCallback, onIdlePromise}
