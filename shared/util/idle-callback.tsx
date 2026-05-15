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
  }, 20) as unknown as number
}

const _window = global.window

const useFallback =
  !_window?.requestIdleCallback ||
  // Timers in RN in chrome are super problematic. https://github.com/facebook/react-native/issues/4470
  (isMobile && isDebuggingInChrome) ||
  isMobile // AND.. idle timers are entirely broken on ios on device https://github.com/facebook/react-native/pull/29895

type CBType = (cb: (info: TimeoutInfo) => void, opt?: Options) => number
export const requestIdleCallback: CBType = forceImmediateLogging
  ? immediateCallback
  : useFallback
    ? timeoutFallback
    : (_window.requestIdleCallback as CBType).bind(_window)
