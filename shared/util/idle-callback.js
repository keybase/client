// @flow
import {forceImmediateLogging} from '../local-debug'
import {isMobile, isAndroid} from '../constants/platform'
import {runAfterInteractions} from './interaction-manager'

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

function runAfterInteractionsFallback(
  cb: (info: TimeoutInfo) => void,
  deadlineOpts?: {timeout: number}
): {cancel: () => void} {
  return runAfterInteractions(function() {
    cb({
      didTimeout: true,
      timeRemaining: function() {
        return 0
      },
    })
  }, (deadlineOpts && deadlineOpts.timeout) || 20)
}

function cancelRunAfterInteractionsFallback(cancellablePromise: {cancel: () => void}) {
  cancellablePromise.cancel()
}

function cancelIdleCallbackFallback(id: TimeoutID) {
  id && clearTimeout(id)
}

// TODO: Re-enable requestIdleCallback for Android once https://github.com/facebook/react-native/issues/9579 is fixed
const useFallback = typeof window === 'undefined' || isAndroid || !window.requestIdleCallback
const requestIdleCallback = forceImmediateLogging
  ? immediateCallback
  : useFallback
    ? isMobile
      ? runAfterInteractionsFallback
      : timeoutFallback
    : window.requestIdleCallback.bind(window)
const cancelIdleCallback = useFallback
  ? isMobile
    ? cancelRunAfterInteractionsFallback
    : cancelIdleCallbackFallback
  : window.cancelIdleCallback.bind(window)

const onIdlePromise = (timeout: number = 100): Promise<TimeoutInfo> =>
  new Promise(resolve => requestIdleCallback(resolve, {timeout}))

export {requestIdleCallback, cancelIdleCallback, onIdlePromise}
