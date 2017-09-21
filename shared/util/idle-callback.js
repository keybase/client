// @flow
import {forceImmediateLogging} from '../local-debug'
import {isMobile, isAndroid} from '../constants/platform'
import {runAfterInteractions} from './interaction-manager'

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

function runAfterInteractionsFallback(
  cb: (info: {didTimeout: boolean, timeRemaining: () => number}) => void,
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

function cancelIdleCallbackFallback(id: number) {
  clearTimeout(id)
}

// TODO: Re-enable requestIdleCallback for Android once https://github.com/facebook/react-native/issues/9579 is fixed
const useFallback = typeof window === 'undefined' || isAndroid || !window.requestIdleCallback
const requestIdleCallback = forceImmediateLogging
  ? immediateCallback
  : useFallback
      ? isMobile ? runAfterInteractionsFallback : timeoutFallback
      : window.requestIdleCallback.bind(window)
const cancelIdleCallback = useFallback
  ? isMobile ? cancelRunAfterInteractionsFallback : cancelIdleCallbackFallback
  : window.cancelIdleCallback.bind(window)

const onIdlePromise = (timeout: number = 100) => {
  const p: Promise<*> = new Promise(resolve => requestIdleCallback(resolve, {timeout}))
  return p
}

export {requestIdleCallback, cancelIdleCallback, onIdlePromise}
