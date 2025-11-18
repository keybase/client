import * as React from 'react'

export function useSafeSubmit<F extends (...a: Array<unknown>) => void>(f: F, shouldReset: boolean) {
  const safeToCallRef = React.useRef(true)

  React.useEffect(() => {
    if (shouldReset) {
      safeToCallRef.current = true
    }
  }, [shouldReset])

  const safeWrapped = React.useCallback(
    (...args: Array<unknown>) => {
      if (safeToCallRef.current) {
        safeToCallRef.current = false
        f(...args)
      } else {
      }
    },
    [f]
  )

  return safeWrapped
}
