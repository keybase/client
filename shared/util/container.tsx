import * as React from 'react'

// Deprecated: avoid useEffect
export function usePrevious<T>(value: T) {
  const [current, setCurrent] = React.useState(value)
  const [previous, setPrevious] = React.useState<T | undefined>(undefined)

  if (value !== current) {
    setPrevious(current)
    setCurrent(value)
  }

  return previous
}

export {useSafeSubmit} from './safe-submit'
export {useSafeNavigation} from './safe-navigation'
