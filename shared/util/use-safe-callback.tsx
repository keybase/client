import * as React from 'react'
/** a hook to control calling a callback. Disallows a call when unmounted
 */

type Options = Partial<{
  /** Only allow once call per mount, true or pass a function that gives you a reset */
  onlyOnce: boolean | ((clearOnce: () => void) => void)
}>
function useSafeCallback<C extends (...args: Array<any>) => void>(cb: C, options?: Options): C {
  const isMounted = React.useRef<boolean>(true)
  const calledThisMount = React.useRef<boolean>(false)

  const clearOnlyOnce = React.useCallback(() => {
    calledThisMount.current = false
  }, [])

  const safe = React.useRef<C>(((...a: Array<any>) => {
    if (isMounted.current && (!options?.onlyOnce || calledThisMount.current === false)) {
      cb(...a)
    }
    calledThisMount.current = true
  }) as any)

  const onlyOnce = options?.onlyOnce

  React.useEffect(() => {
    if (typeof onlyOnce === 'function') {
      onlyOnce?.(clearOnlyOnce)
    }
  }, [onlyOnce, clearOnlyOnce])

  React.useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  return safe.current
}

export default useSafeCallback
