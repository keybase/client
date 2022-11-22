import * as React from 'react'

export function useSafeSubmit<F extends Function>(f: F, shouldReset: boolean) {
  const safeToCallRef = React.useRef(true)

  React.useEffect(() => {
    if (shouldReset) {
      safeToCallRef.current = true
    }
  }, [shouldReset])

  const safeWrapped = React.useCallback(
    (...args: Array<any>) => {
      if (safeToCallRef.current) {
        safeToCallRef.current = false
        f(...args)
      } else {
      }
    },
    [f]
  )

  return safeWrapped as any as F
}
