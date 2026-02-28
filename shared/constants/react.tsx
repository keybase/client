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
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const isMounted = React.useCallback(() => mounted.current, [])
  return isMounted
}

export const useOnMountOnce = (fn: () => void, timeout = 1) => {
  const hasCalledRef = React.useRef(false)
  const timeoutIdRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstFNRef = React.useRef(fn)
  const timeoutRef = React.useRef(timeout)

  React.useEffect(() => {
    timeoutIdRef.current = setTimeout(() => {
      if (!hasCalledRef.current) {
        hasCalledRef.current = true
        firstFNRef.current()
      }
    }, timeoutRef.current)

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }
  }, [])
}

// Run a function on unmount, doesn't rerun if the function changes
export const useOnUnMountOnce = (f: () => void) => {
  const ref = React.useRef<undefined | (() => void)>(f)
  React.useEffect(() => {
    return () => {
      ref.current?.()
      ref.current = undefined
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
