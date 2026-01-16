// This hook sends props to a remote window
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
// If asked we'll send all props, otherwise we do a shallow compare and send the different ones
import * as React from 'react'
import * as C from '@/constants'
import KB2 from '@/util/electron.desktop'
import isEqual from 'lodash/isEqual'
import {useConfigState} from '@/stores/config'

const {rendererNewProps} = KB2.functions

// set this to true to see details of the serialization process
const debugSerializer: boolean = __DEV__ && (false as boolean)
if (debugSerializer) {
  console.log('\n\n\n\n\n\nDEBUGGING REMOTE SERIALIZER')
}

export default function useSerializeProps<ProxyProps extends object, SerializeProps extends object>(
  p: ProxyProps,
  serializer: (p: ProxyProps) => Partial<SerializeProps>,
  windowComponent: string,
  windowParam: string
) {
  const lastSent = React.useRef<Partial<SerializeProps>>({})
  const lastForceUpdate = React.useRef<number>(-1)
  const currentForceUpdate = useConfigState(
    s => s.remoteWindowNeedsProps.get(windowComponent)?.get(windowParam) ?? 0
  )

  const throttledSend = C.useThrottledCallback(
    (p: ProxyProps, forceUpdate: boolean) => {
      const lastToSend: {[key: string]: unknown} = forceUpdate ? {} : lastSent.current
      const serialized = serializer(p)
      const toSend = {...serialized} as {[key: string]: unknown}
      // clear undefineds / exact dupes
      Object.keys(toSend).forEach(k => {
        if (toSend[k] === undefined || isEqual(toSend[k], lastToSend[k])) {
          delete toSend[k] // eslint-disable-line
        }
      })

      if (Object.keys(toSend).length) {
        const propsStr = JSON.stringify(toSend)
        debugSerializer && console.log('[useSerializeProps]: throttled send', propsStr.length, toSend)
        rendererNewProps?.({propsStr, windowComponent, windowParam})
      }
      lastSent.current = serialized
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
