import * as React from 'react'

const noop = () => {}

// useTimeout returns a function that can be used to start a timer that
// finishes after timing has passed since the start function is called. When
// timer finishes, func is called.
//
// Input parameters are ignoerd except first time.
//
// The returned function can be called multiple times. If it's called before
// the previous timer finished, the timer is extended. If it's called after the
// timer finishes, a new timer is created.
//
// The returned function should remain constant through the component
// lifecycle.
export const useTimeout = (func: () => any, timing: number): (() => void) => {
  const [t, setT] = React.useState<null | number>(null)
  const [counter, setCounter] = React.useState(0)
  const onceRef = React.useRef({
    func: noop,
    isSet: false,
    timing: 0,
  })
  React.useEffect(() => {
    if (!onceRef.current.isSet) {
      onceRef.current = {
        func,
        isSet: true,
        timing,
      }
    }
  })
  React.useEffect(() => {
    if (t === null) {
      return noop
    }
    const id = setTimeout(() => onceRef.current.func(), t)
    return () => clearTimeout(id)
  }, [counter, t])

  return React.useCallback(() => {
    setT(onceRef.current.timing)
    setCounter(counter => counter + 1)
  }, [setT, setCounter, onceRef])
}

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export const useInterval = (func: () => any, interval?: number) => {
  const cb = React.useRef(func)
  React.useEffect(() => {
    cb.current = func
  })
  React.useEffect(() => {
    if (typeof interval !== 'number') {
      return noop
    }
    const id = setInterval(() => cb.current(), interval)
    return () => clearInterval(id)
  }, [interval])
}
