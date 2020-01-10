import * as React from 'react'
/** a hook to control calling a callback. Disallows a call when unmounted
 */

type Options = Partial<{
  /** Only allow once call per mount */
  onlyOnce: boolean
}>
function useSafeCallback<C extends (...args: Array<any>) => void>(cb: C, options?: Options): C {
  const isMounted = React.useRef<boolean>(true)
  const calledThisMount = React.useRef<boolean>(false)
  React.useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])
  const safe: C = ((...a: Array<any>) => {
    if (isMounted.current && (!options?.onlyOnce || calledThisMount.current === false)) {
      cb(...a)
    }
    calledThisMount.current = true
  }) as any
  return safe
}

export default useSafeCallback
