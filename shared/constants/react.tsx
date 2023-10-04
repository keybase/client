import * as React from 'react'

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
