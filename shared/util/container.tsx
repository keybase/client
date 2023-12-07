import * as React from 'react'

// Deprecated: avoid useEffect
export function usePrevious<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  })
  return ref.current
}

/**
      like useEffect but doesn't call on initial mount, only when deps change
TODO deprecate
 */

export function useDepChangeEffect(f: () => void, deps: Array<unknown>) {
  const mounted = React.useRef(false)

  React.useEffect(() => {
    if (mounted.current) {
      f()
    } else {
      mounted.current = true
    }
    // eslint-disable-next-line
  }, deps)
}

export {useSafeSubmit} from './safe-submit'
export {useSafeNavigation} from './safe-navigation'
