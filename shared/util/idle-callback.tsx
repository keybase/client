import {forceImmediateLogging} from '@/local-debug'
import {isMobile, isDebuggingInChrome} from '@/constants/platform'

type TimeoutInfo = {
  didTimeout: boolean
  timeRemaining: () => number
}

type Options = {
  timeout?: number
}

function immediateCallback(cb: (info: TimeoutInfo) => void): number {
  cb({didTimeout: true, timeRemaining: () => 0})
  return 0
}

function timeoutFallback(cb: (info: TimeoutInfo) => void): number {
  return setTimeout(function () {
    cb({
      didTimeout: true,
      timeRemaining: function () {
        return 0
      },
    })
  }, 20) as any as number
}

const useFallback =
  typeof window === 'undefined' ||
  // eslint-disable-next-line
  !window.requestIdleCallback ||
  // Timers in RN in chrome are super problematic. https://github.com/facebook/react-native/issues/4470
  (isMobile && isDebuggingInChrome) ||
  isMobile // AND.. idle timers are entirely broken on ios on device https://github.com/facebook/react-native/pull/29895

type CBType = (cb: (info: TimeoutInfo) => void, opt?: Options) => number
export const requestIdleCallback: CBType = forceImmediateLogging
  ? immediateCallback
  : useFallback
    ? timeoutFallback
    : window.requestIdleCallback.bind(window)
