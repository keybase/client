import * as React from 'react'
import {isQuietCancel, type RPCError} from './errors'

type RPCPromiseType<F extends (...rest: any[]) => any, RF = ReturnType<F>> =
  RF extends Promise<infer U> ? U : RF

/** A hook to make an RPC call. This entirely skips our state layer and shouldn't be used if you need any side effects
 @param call: the rpc function you intend to call
 @returns submit: ([rpcArgs], setResult: (rpcResult) => void, setError: (RPCError) => void) => void
 */
function useRPC<
  C extends (...r: any[]) => any,
  RET = RPCPromiseType<C>,
  ARGS extends Array<any> = Parameters<C>,
>(call: C) {
  const submit = React.useMemo(
    () => (args: ARGS, setResult: (r: RET) => void, setError: (e: RPCError) => void) => {
      const called = call(...args) as Promise<RET>
      called
        .then((result: RET) => {
          setResult(result)
        })
        .catch((error: RPCError) => {
          // Cancelled, so nothing failed. A lost link is still an error: the action did not happen, and
          // the caller may need to reset what it showed meanwhile.
          if (!isQuietCancel(error)) {
            setError(error)
          }
        })
    },
    [call]
  )
  return submit
}

export default useRPC
