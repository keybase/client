import * as C from '@/constants'
import * as React from 'react'

// navigate up once a waiting flag finishes without an error, e.g. to close a
// modal after its RPC succeeds
export const useNavUpWhenDone = (waiting: boolean, error?: unknown) => {
  const prevWaitingRef = React.useRef(waiting)
  React.useEffect(() => {
    if (!waiting && prevWaitingRef.current && !error) {
      C.Router2.navigateUp()
    }
    prevWaitingRef.current = waiting
  }, [waiting, error])
}
