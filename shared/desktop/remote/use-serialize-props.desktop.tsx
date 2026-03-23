// This hook sends props to a remote window
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
import * as React from 'react'
import * as C from '@/constants'
import KB2 from '@/util/electron.desktop'
import {useConfigState} from '@/stores/config'

const {rendererNewProps} = KB2.functions

// set this to true to see details of the serialization process
const debugSerializer: boolean = __DEV__ && (false as boolean)
if (debugSerializer) {
  console.log('\n\n\n\n\n\nDEBUGGING REMOTE SERIALIZER')
}

export default function useSerializeProps<P extends object>(
  p: P,
  windowComponent: string,
  windowParam: string
) {
  const lastSent = React.useRef('')
  const lastForceUpdate = React.useRef(-1)
  const currentForceUpdate = useConfigState(
    s => s.remoteWindowNeedsProps.get(windowComponent)?.get(windowParam) ?? 0
  )

  const throttledSend = C.useThrottledCallback(
    (p: P, forceUpdate: boolean) => {
      const propsStr = JSON.stringify(p)
      if (!forceUpdate && propsStr === lastSent.current) return
      debugSerializer && console.log('[useSerializeProps]: throttled send', propsStr.length)
      rendererNewProps?.({propsStr, windowComponent, windowParam})
      lastSent.current = propsStr
      lastForceUpdate.current = currentForceUpdate
    },
    1000,
    {leading: true}
  )

  React.useEffect(
    () => {
      if (!windowComponent) {
        return
      }
      const forceUpdate = currentForceUpdate !== lastForceUpdate.current
      throttledSend(p, forceUpdate)
    },
    // eslint-disable-next-line
    [...Object.values(p), currentForceUpdate]
  )
}
