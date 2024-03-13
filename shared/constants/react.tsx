import * as React from 'react'

export const useLogMount = () => {
  React.useEffect(() => {
    console.log('aaaa mounted')
    return () => {
      console.log('aaaa UNmounted')
    }
  }, [])
}

// Get the mounted state of a component
export const useIsMounted = () => {
  const mounted = React.useRef(true)
  React.useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])
  const isMounted = React.useCallback(() => mounted.current, [])
  return isMounted
}

// Run a function on mount once
export const useOnMountOnce = (f: () => void) => {
  const onceRef = React.useRef(true)
  if (onceRef.current) {
    onceRef.current = false
    // defer a frame so you don't get react issues
    setTimeout(f, 1)
  }
}

// Run a function on unmount, doesn't rerun if the function changes
export const useOnUnMountOnce = (f: () => void) => {
  const ref = React.useRef(f)
  ref.current = f
  React.useEffect(() => {
    return () => {
      ref.current()
    }
  }, [])
}

type Fn<ARGS extends any[], R> = (...args: ARGS) => R

// a hacky version of https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md until its really added
// its UNSAFE to call this in reaction immediately in a hook since it uses useLayoutEffect (aka the reduce useEffect changes)
export const useEvent = <Arr extends any[], R>(fn: Fn<Arr, R>): Fn<Arr, R> => {
  const ref = React.useRef<Fn<Arr, R>>(fn)
  React.useLayoutEffect(() => {
    ref.current = fn
  })
  return React.useMemo(
    () =>
      (...args: Arr): R =>
        ref.current(...args),
    []
  )
}
