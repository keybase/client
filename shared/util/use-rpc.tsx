import * as React from 'react'
/** A hook to make an RPC call. This entirely skips our redux layer and shouldn't be used if you need any side effects
 */

function useRPC<ARGS extends Array<any>, RES extends Promise<any>, C extends (args?: ARGS) => RES>(
  rpcCall: C,
  args: ARGS,
  skipCall: boolean,
  triggers: Array<any>
): [RES | undefined, Boolean] {
  const [loading, setLoading] = React.useState<Boolean>(true)
  const [result, setResult] = React.useState<RES | undefined>(undefined)
  React.useEffect(() => {
    if (skipCall) {
      setLoading(false)
    } else {
      const fetchData = async () => {
        const r = await rpcCall(args)
        setResult(r)
        setLoading(false)
      }
      setLoading(true)
      setResult(undefined)
      fetchData()
    }
    // eslint-disable-next-line
  }, triggers)
  return [result, loading]
}

export default useRPC
