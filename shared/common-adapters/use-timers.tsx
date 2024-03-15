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

  const timeoutIDRef = React.useRef<ReturnType<typeof setTimeout>>()

  const timerCB = React.useCallback(() => {
    savedCallback.current()
  }, [])

  React.useEffect(() => {
    return () => {
      clearTimeout(timeoutIDRef.current)
    }
  }, [])

  return React.useCallback(() => {
    timeoutIDRef.current = setTimeout(timerCB, timing)
  }, [timerCB, timing])
}

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export const useInterval = (func: () => any, interval?: number) => {
  const cb = React.useRef(func)
  React.useEffect(() => {
    cb.current = func
  }, [func])
  React.useEffect(() => {
    if (typeof interval !== 'number') {
      return noop
    }
    const id = setInterval(() => cb.current(), interval)
    return () => clearInterval(id)
  }, [interval])
}
