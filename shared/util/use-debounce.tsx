/* eslint-disable react-hooks/purity */
import * as React from 'react'

type AnyFunction = (...args: Array<any>) => any
type TimerID = ReturnType<typeof setTimeout>

type DebounceRuntime<T extends AnyFunction> = {
  lastArgs?: Parameters<T>
  lastCallTime?: number
  lastResult?: ReturnType<T>
  timerID?: TimerID
}

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

export function useDebouncedCallback<T extends AnyFunction>(
  func: T,
  wait?: number,
  options?: DebounceOptions
): DebouncedState<T> {
  const funcRef = React.useRef(func)
  React.useLayoutEffect(() => {
    funcRef.current = func
  }, [func])
  const runtimeRef = React.useRef<DebounceRuntime<T>>({})

  const waitMs = normalizeWait(wait)
  const leading = options?.leading ?? false
  const trailing = options?.trailing ?? true

  const debounced = React.useMemo(() => {
    const clearTimer = () => {
      const runtime = runtimeRef.current
      if (runtime.timerID !== undefined) {
        clearTimeout(runtime.timerID)
        runtime.timerID = undefined
      }
    }

    const invoke = () => {
      const runtime = runtimeRef.current
      const args = runtime.lastArgs
      runtime.lastArgs = undefined
      if (!args) {
        return runtime.lastResult
      }
      const result = funcRef.current(...args)
      runtime.lastResult = result
      return result
    }

    const remainingWait = (time: number) => {
      const sinceLastCall = time - (runtimeRef.current.lastCallTime ?? 0)
      return waitMs - sinceLastCall
    }

    const shouldInvoke = (time: number) => {
      const {lastCallTime} = runtimeRef.current
      if (lastCallTime === undefined) {
        return true
      }
      const sinceLastCall = time - lastCallTime
      return sinceLastCall >= waitMs || sinceLastCall < 0
    }

    const trailingEdge = () => {
      clearTimer()
      const runtime = runtimeRef.current
      if (trailing && runtime.lastArgs) {
        return invoke()
      }
      runtime.lastArgs = undefined
      return runtime.lastResult
    }

    const timerExpired = () => {
      const time = Date.now()
      if (shouldInvoke(time)) {
        trailingEdge()
        return
      }
      runtimeRef.current.timerID = setTimeout(timerExpired, remainingWait(time))
    }

    const leadingEdge = () => {
      const runtime = runtimeRef.current
      runtime.timerID = setTimeout(timerExpired, waitMs)
      return leading ? invoke() : runtime.lastResult
    }

    const next = ((...args: Parameters<T>) => {
      const time = Date.now()
      const invokeNow = shouldInvoke(time)
      const runtime = runtimeRef.current

      runtime.lastArgs = args
      runtime.lastCallTime = time

      if (invokeNow && runtime.timerID === undefined) {
        return leadingEdge()
      }

      clearTimer()
      runtime.timerID = setTimeout(timerExpired, waitMs)
      return runtime.lastResult
    }) as DebouncedState<T>

    next.cancel = () => {
      clearTimer()
      const runtime = runtimeRef.current
      runtime.lastArgs = undefined
      runtime.lastCallTime = undefined
    }

    next.flush = () => {
      const runtime = runtimeRef.current
      if (runtime.timerID === undefined) {
        return runtime.lastResult
      }
      return trailingEdge()
    }

    next.isPending = () => runtimeRef.current.timerID !== undefined

    return next
  }, [leading, trailing, waitMs])

  React.useEffect(() => () => debounced.cancel(), [debounced])

  return debounced
}

export function useThrottledCallback<T extends AnyFunction>(
  func: T,
  wait: number,
  options?: DebounceOptions
): DebouncedState<T> {
  const funcRef = React.useRef(func)
  React.useLayoutEffect(() => {
    funcRef.current = func
  }, [func])
  const runtimeRef = React.useRef<{
    lastArgs?: Parameters<T>
    lastInvokeTime?: number
    lastResult?: ReturnType<T>
    timerID?: TimerID
  }>({})

  const waitMs = normalizeWait(wait)
  const leading = options?.leading ?? true
  const trailing = options?.trailing ?? true

  const throttled = React.useMemo(() => {
    const clearTimer = () => {
      const runtime = runtimeRef.current
      if (runtime.timerID !== undefined) {
        clearTimeout(runtime.timerID)
        runtime.timerID = undefined
      }
    }

    const invoke = (time: number, args: Parameters<T>) => {
      const runtime = runtimeRef.current
      runtime.lastArgs = undefined
      runtime.lastInvokeTime = time
      const result = funcRef.current(...args)
      runtime.lastResult = result
      return result
    }

    const schedule = (time: number) => {
      const runtime = runtimeRef.current
      if (runtime.timerID !== undefined) {
        return
      }
      const delay =
        runtime.lastInvokeTime === undefined
          ? waitMs
          : Math.max(0, waitMs - (time - runtime.lastInvokeTime))
      runtime.timerID = setTimeout(() => {
        const runtime = runtimeRef.current
        runtime.timerID = undefined
        if (trailing && runtime.lastArgs) {
          invoke(Date.now(), runtime.lastArgs)
        } else {
          runtime.lastArgs = undefined
        }
      }, delay)
    }

    const next = ((...args: Parameters<T>) => {
      const time = Date.now()
      const runtime = runtimeRef.current
      runtime.lastArgs = args

      if (
        leading &&
        (runtime.lastInvokeTime === undefined || time - runtime.lastInvokeTime >= waitMs)
      ) {
        const result = invoke(time, args)
        schedule(time)
        return result
      }

      schedule(time)
      return runtime.lastResult
    }) as DebouncedState<T>

    next.cancel = () => {
      clearTimer()
      const runtime = runtimeRef.current
      runtime.lastArgs = undefined
      runtime.lastInvokeTime = undefined
    }

    next.flush = () => {
      const runtime = runtimeRef.current
      if (runtime.timerID === undefined) {
        return runtime.lastResult
      }
      clearTimer()
      if (trailing && runtime.lastArgs) {
        return invoke(Date.now(), runtime.lastArgs)
      }
      runtime.lastArgs = undefined
      return runtime.lastResult
    }

    next.isPending = () => runtimeRef.current.timerID !== undefined

    return next
  }, [leading, trailing, waitMs])

  React.useEffect(() => () => throttled.cancel(), [throttled])

  return throttled
}
