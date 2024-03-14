import * as React from 'react'

// Deprecated: avoid useEffect
export function usePrevious<T>(value: T) {
  const ref = React.useRef<T>()
  React.useEffect(() => {
    ref.current = value
  })
  return ref.current
}

export {useSafeSubmit} from './safe-submit'
export {useSafeNavigation} from './safe-navigation'
