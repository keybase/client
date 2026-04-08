/* eslint-disable react-hooks/purity */
import * as React from 'react'

type AnyFunction = (...args: Array<any>) => any
type TimerID = ReturnType<typeof setTimeout>

export type DebouncedState<T extends AnyFunction> = ((...args: Parameters<T>) => ReturnType<T> | undefined) & {
  cancel: () => void
  flush: () => ReturnType<T> | undefined
  isPending: () => boolean
}

type DebounceOptions = {
  leading?: boolean
  trailing?: boolean
}

const normalizeWait = (wait?: number) => Math.max(0, wait ?? 0)

export const useDebouncedCallback = <T extends AnyFunction>(
  func: T,
  wait?: number,
  options?: DebounceOptions
): DebouncedState<T> => {
  const funcRef = React.useRef(func)
  funcRef.current = func

  const waitMs = normalizeWait(wait)
  const leading = options?.leading ?? false
  const trailing = options?.trailing ?? true

  const debounced = React.useMemo(() => {
    let lastArgs: Parameters<T> | undefined
    let lastCallTime: number | undefined
    let lastResult: ReturnType<T> | undefined
    let timerID: TimerID | undefined

    const clearTimer = () => {
      if (timerID !== undefined) {
        clearTimeout(timerID)
        timerID = undefined
      }
    }

    const invoke = () => {
      const args = lastArgs
      lastArgs = undefined
      if (!args) {
        return lastResult
      }
      const result = funcRef.current(...args)
      lastResult = result
      return result
    }

    const remainingWait = (time: number) => {
      const sinceLastCall = time - (lastCallTime ?? 0)
      return waitMs - sinceLastCall
    }

    const shouldInvoke = (time: number) => {
      if (lastCallTime === undefined) {
        return true
      }
      const sinceLastCall = time - lastCallTime
      return sinceLastCall >= waitMs || sinceLastCall < 0
    }

    const trailingEdge = () => {
      clearTimer()
      if (trailing && lastArgs) {
        return invoke()
      }
      lastArgs = undefined
      return lastResult
    }

    const timerExpired = () => {
      const time = Date.now()
      if (shouldInvoke(time)) {
        trailingEdge()
        return
      }
      timerID = setTimeout(timerExpired, remainingWait(time))
    }

    const leadingEdge = () => {
      timerID = setTimeout(timerExpired, waitMs)
      return leading ? invoke() : lastResult
    }

    const next = ((...args: Parameters<T>) => {
      const time = Date.now()
      const invokeNow = shouldInvoke(time)

      lastArgs = args
      lastCallTime = time

      if (invokeNow && timerID === undefined) {
        return leadingEdge()
      }

      clearTimer()
      timerID = setTimeout(timerExpired, waitMs)
      return lastResult
    }) as DebouncedState<T>

    next.cancel = () => {
      clearTimer()
      lastArgs = undefined
      lastCallTime = undefined
    }

    next.flush = () => {
      if (timerID === undefined) {
        return lastResult
      }
      return trailingEdge()
    }

    next.isPending = () => timerID !== undefined

    return next
  }, [leading, trailing, waitMs])

  React.useEffect(() => () => debounced.cancel(), [debounced])

  return debounced
}

export const useThrottledCallback = <T extends AnyFunction>(
  func: T,
  wait: number,
  options?: DebounceOptions
): DebouncedState<T> => {
  const funcRef = React.useRef(func)
  funcRef.current = func

  const waitMs = normalizeWait(wait)
  const leading = options?.leading ?? true
  const trailing = options?.trailing ?? true

  const throttled = React.useMemo(() => {
    let lastArgs: Parameters<T> | undefined
    let lastInvokeTime: number | undefined
    let lastResult: ReturnType<T> | undefined
    let timerID: TimerID | undefined

    const clearTimer = () => {
      if (timerID !== undefined) {
        clearTimeout(timerID)
        timerID = undefined
      }
    }

    const invoke = (time: number, args: Parameters<T>) => {
      lastArgs = undefined
      lastInvokeTime = time
      const result = funcRef.current(...args)
      lastResult = result
      return result
    }

    const schedule = (time: number) => {
      const delay =
        lastInvokeTime === undefined ? waitMs : Math.max(0, waitMs - (time - lastInvokeTime))
      clearTimer()
      timerID = setTimeout(() => {
        timerID = undefined
        if (trailing && lastArgs) {
          invoke(Date.now(), lastArgs)
        } else {
          lastArgs = undefined
        }
      }, delay)
    }

    const next = ((...args: Parameters<T>) => {
      const time = Date.now()
      lastArgs = args

      if (leading && (lastInvokeTime === undefined || time - lastInvokeTime >= waitMs)) {
        const result = invoke(time, args)
        schedule(time)
        return result
      }

      schedule(time)
      return lastResult
    }) as DebouncedState<T>

    next.cancel = () => {
      clearTimer()
      lastArgs = undefined
      lastInvokeTime = undefined
    }

    next.flush = () => {
      if (timerID === undefined) {
        return lastResult
      }
      clearTimer()
      if (trailing && lastArgs) {
        return invoke(Date.now(), lastArgs)
      }
      lastArgs = undefined
      return lastResult
    }

    next.isPending = () => timerID !== undefined

    return next
  }, [leading, trailing, waitMs])

  React.useEffect(() => () => throttled.cancel(), [throttled])

  return throttled
}
