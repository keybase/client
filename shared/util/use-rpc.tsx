import * as React from 'react'
import {RPCError} from './errors'
import useMounted from '../common-adapters/use-mounted'
/** A hook to make an RPC call. This entirely skips our redux layer and shouldn't be used if you need any side effects
 */

// TODO useReducer
// type Action = {
// } | {
// }
// const rpcReducer = (state, action) => {

// }

function useRPC<T>(): (promise: Promise<T>) => T | undefined {
  let isMounted = true
  React.useEffect(() => {
    return () => {
      isMounted = false
    }
  }, [])

  const submit = async (promise: Promise<T>) => {
    const result = await promise

    await new Promise(resolve => setTimeout(resolve, 5000))
    if (isMounted) {
      return result
    } else {
      throw new Error()
    }
  }
  return submit
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
