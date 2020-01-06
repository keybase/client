// This hook sends props to a remote window
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
// If asked we'll send all props, otherwise we do a shallow compare and send the different ones
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Container from '../../util/container'
import throttle from 'lodash/throttle'

// set this to true to see details of the serialization process
const debugSerializer = __DEV__ && true
if (debugSerializer) {
  console.log('\n\n\n\n\n\nDEBUGGING REMOTE SERIALIZER')
}

export default function useSerializeProps<ProxyProps extends {}, SerializeProps extends {}>(
  p: ProxyProps,
  serializer: (
    p: ProxyProps,
    old: Partial<SerializeProps>
  ) => [Partial<SerializeProps>, Partial<SerializeProps>],
  windowComponent: string,
  windowParam: string
) {
  const lastSent = React.useRef<Partial<SerializeProps>>({})
  const lastForceUpdate = React.useRef<number>(-1)
  const currentForceUpdate = Container.useSelector(s =>
    windowComponent ? s.config.remoteWindowNeedsProps.get(windowComponent)?.get(windowParam) ?? 0 : 0
  )

  const throttledSend = React.useRef(
    throttle(
      (toSend: Partial<SerializeProps>, toCache: Partial<SerializeProps>) => {
        const propsStr = JSON.stringify(toSend)
        debugSerializer && console.log('[useSerializeProps]: throttled send', propsStr.length, toSend)
        SafeElectron.getApp().emit('KBkeybase', '', {
          payload: {
            propsStr,
            windowComponent,
            windowParam,
          },
          type: 'rendererNewProps',
        })
        lastSent.current = toCache
      },
      1000,
      {leading: true}
    )
  )

  React.useEffect(
    () => {
      if (!windowComponent) {
        return
      }
      const forceUpdate = currentForceUpdate !== lastForceUpdate.current
      const [toSend, toCache] = serializer(p, forceUpdate ? {} : lastSent.current)
      throttledSend.current(toSend, toCache)
      lastForceUpdate.current = currentForceUpdate
    },
    // eslint-disable-next-line
    [...Object.values(p), currentForceUpdate]
  )
}
