// This hook sends props to a remote window
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
// If asked we'll send all props, otherwise we do a shallow compare and send the different ones
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Container from '../../util/container'
import throttle from 'lodash/throttle'

// set this to true to see details of the serialization process
const debugSerializer = __DEV__ && false
if (debugSerializer) {
  console.log('\n\n\n\n\n\nDEBUGGING REMOTE SERIALIZER')
}

export default function useSerializeProps<Props extends {}>(
  p: Props,
  serializer: (p: Props, old: Partial<Props>) => Partial<Props>,
  windowComponent: string,
  windowParam: string
) {
  const lastSent = React.useRef<Partial<Props>>({})
  const lastForceUpdate = React.useRef<number>(-1)
  const currentForceUpdate = Container.useSelector(s =>
    windowComponent ? s.config.remoteWindowNeedsProps.get(windowComponent)?.get(windowParam) ?? 0 : 0
  )

  const throttledSend = React.useRef(
    throttle(
      (toSend: Partial<Props>, windowComponent: string, windowParam: string) => {
        SafeElectron.getApp().emit('KBkeybase', '', {
          payload: {
            propsStr: JSON.stringify(toSend),
            windowComponent,
            windowParam,
          },
          type: 'rendererNewProps',
        })
        lastSent.current = toSend
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
      const toSend = serializer(p, forceUpdate ? {} : lastSent.current)
      Object.keys(toSend).length && throttledSend.current(p, windowComponent, windowParam)
      lastForceUpdate.current = currentForceUpdate
    },
    // eslint-disable-next-line
    [...Object.values(p), currentForceUpdate]
  )
}
