import * as React from 'react'

export const useLogMount = () => {
  React.useEffect(() => {
    console.log('aaaa mounted')
    return () => {
      console.log('aaaa UNmounted')
    }
  }, [])
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

