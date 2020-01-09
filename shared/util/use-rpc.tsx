import * as React from 'react'
import {RPCError} from './errors'
/** A hook to make an RPC call. This entirely skips our redux layer and shouldn't be used if you need any side effects
 */

function useRPC<ARGS extends Array<any>, RES extends Promise<any>, C extends (args?: ARGS) => RES>(
  rpcCall: C,
  args: ARGS,
  skipCall: boolean,
  triggers: Array<any>
): [RPCError | undefined, RES | undefined, Boolean] {
  const [loading, setLoading] = React.useState<Boolean>(true)
  const [result, setResult] = React.useState<RES | undefined>(undefined)
  const [error, setError] = React.useState<RPCError | undefined>(undefined)
  React.useEffect(() => {
    if (skipCall) {
      setLoading(false)
      setError(undefined)
    } else {
      const fetchData = async () => {
        try {
          const r = await rpcCall(args)
          setResult(r)
        } catch (e) {
          setError(e)
        } finally {
          setLoading(false)
        }
      }
      setLoading(true)
      setResult(undefined)
      fetchData()
    }
    // eslint-disable-next-line
  }, triggers)
  return [error, result, loading]
}

export default useRPC
