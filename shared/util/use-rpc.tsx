import * as React from 'react'
import {RPCError} from './errors'
import {useMemo} from './memoize'

type RPCPromiseType<F extends (...rest: any[]) => any, RF = ReturnType<F>> = RF extends Promise<infer U>
  ? U
  : RF

/** A hook to make an RPC call. This entirely skips our redux layer and shouldn't be used if you need any side effects
setResult is only called if you're still mounted
 @param call: the rpc function you intend to call
 @returns submit: ([rpcArgs], setResult: (rpcResult) => void, setError: (RPCError) => void) => void
 */
function useRPC<
  C extends (...r: Array<any>) => any,
  RET = RPCPromiseType<C>,
  ARGS extends Array<any> = Parameters<C>
>(call: C) {
  const isMounted = React.useRef<Boolean>(true)

  React.useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const submit = useMemo(
    () => async (args: ARGS, setResult: (r: RET) => void, setError: (e: RPCError) => void) => {
      try {
        const result = await call(...args)
        if (isMounted.current) {
          setResult(result)
        }
      } catch (e) {
        if (isMounted.current) {
          setError(e)
        }
      }
    },
    [call]
  )
  return submit
}

export default useRPC
