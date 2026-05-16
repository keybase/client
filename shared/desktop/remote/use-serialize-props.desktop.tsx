// This hook sends props to a remote window
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
import * as React from 'react'
import * as C from '@/constants'
import KB2 from '@/util/electron.desktop'
import {useConfigState} from '@/stores/config'
import type {RemoteComponentName} from '@/desktop/remote/remote-component.desktop'

const {rendererNewProps} = KB2.functions

export default function useSerializeProps<P extends object>(
  props: P,
  windowComponent: RemoteComponentName,
  windowParam: string
) {
  const lastSent = React.useRef('')
  const lastForceUpdate = React.useRef(-1)
  const currentForceUpdate = useConfigState(
    s => s.remoteWindowNeedsProps.get(windowComponent)?.get(windowParam) ?? 0
  )
  const propsStr = JSON.stringify(props)

  const throttledSend = C.useThrottledCallback(
    (nextPropsStr: string, forceUpdateVersion: number) => {
      if (nextPropsStr === lastSent.current && forceUpdateVersion === lastForceUpdate.current) return
      rendererNewProps?.({propsStr: nextPropsStr, windowComponent, windowParam})
      lastSent.current = nextPropsStr
      lastForceUpdate.current = forceUpdateVersion
    },
    1000,
    {leading: true}
  )

  React.useEffect(() => {
    throttledSend(propsStr, currentForceUpdate)
  }, [currentForceUpdate, propsStr, throttledSend])
}
