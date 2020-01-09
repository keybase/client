import * as React from 'react'
import {RPCError} from './errors'
/** A hook to make an RPC call. This entirely skips our redux layer and shouldn't be used if you need any side effects
 */

// TODO useReducer
// type Action = {
// } | {
// }
// const rpcReducer = (state, action) => {

// }

// TODO

type RPCPromiseType<F extends (...rest: any[]) => any, RF = ReturnType<F>> = RF extends Promise<infer U>
  ? U
  : RF

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

  const submit = React.useCallback(
    () => async (args: ARGS, setResult: (r: RET) => void, setError: (e: RPCError) => void) => {
      try {
        const result = await call(...args)
        await new Promise(resolve => setTimeout(resolve, 1000))

        if (isMounted.current) {
          setResult(result)
        }
      } catch (e) {
        if (isMounted.current) {
          setError(e)
        }
      }
    },
    []
  )
  return submit()
}
// function useRPC<ARGS extends Array<any>, RES extends Promise<any>, C extends (args?: ARGS) => RES>(
// rpcCall: C
// ): {error?: RPCError; result?: RES; isLoading: Boolean; submit: (args?: ARGS) => void} {
// const [isLoading, setLoading] = React.useState<Boolean>(true)
// const [result, setResult] = React.useState<RES | undefined>(undefined)
// const [error, setError] = React.useState<RPCError | undefined>(undefined)
// const [callTrigger, setCallTrigger] = React.useState<number>(0)
// const [args, setArgs] = React.useState<ARGS | undefined>(undefined)
// const submit = (args?: ARGS) => {
// setArgs(args)
// setCallTrigger(callTrigger + 1)
// }

// const isMounted = useMounted()
// React.useEffect(() => {
// if (callTrigger === 0) {
// setLoading(false)
// setError(undefined)
// } else {
// const fetchData = async () => {
// try {
// const r = await rpcCall(args)
// if (!isMounted) {
// return
// }
// setResult(r)
// } catch (e) {
// setError(e)
// } finally {
// setLoading(false)
// }
// }
// setLoading(true)
// setResult(undefined)
// fetchData()
// }
// // eslint-disable-next-line
// }, [])
// return {error, isLoading, result, submit}
// }

export default useRPC
