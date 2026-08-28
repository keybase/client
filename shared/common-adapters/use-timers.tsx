import * as React from 'react'

const noop = () => {}

// useTimeout returns a function that can be used to start a timer that
// finishes after timing has passed since the start function is called. When
// timer finishes, func is called.
//
// The returned function can be called multiple times. If it's called before
// the previous timer finished, the timer is extended. If it's called after the
// timer finishes, a new timer is created.
//
// The returned function should remain constant through the component
// lifecycle.
export const useTimeout = (func: () => void, timing: number): (() => void) => {
  const savedCallback = React.useRef(func)
  React.useEffect(() => {
    savedCallback.current = func
  }, [func])

  const timingRef = React.useRef(timing)
  React.useEffect(() => {
    timingRef.current = timing
  }, [timing])

  const timeoutIDRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => {
    return () => {
      clearTimeout(timeoutIDRef.current)
    }
  }, [])

  // the identity has to stay stable: callers pass this to an effect dep list,
  // and a new one each render would restart the timer instead of letting it finish
  return React.useCallback(() => {
    clearTimeout(timeoutIDRef.current)
    timeoutIDRef.current = setTimeout(() => {
      savedCallback.current()
    }, timingRef.current)
  }, [])
}

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export const useInterval = (func: () => unknown, interval?: number) => {
  const cb = React.useRef(func)
  React.useEffect(() => {
    cb.current = func
  }, [func])
  React.useEffect(() => {
    if (typeof interval !== 'number') {
      return noop
    }
    const tick = () => {
      cb.current()
    }
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [interval])
}
