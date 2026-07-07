// This hook sends props to a remote window. The main process caches the last
// value sent per window, so a window that (re)loads pulls the cached props
// itself and no handshake back to this window is needed.
import * as React from 'react'
import * as C from '@/constants'
import KB2 from '@/util/electron'
import {useColorScheme} from 'react-native'
import type {RemoteComponentName} from './remote-component.desktop'

const {rendererNewProps} = KB2.functions

export default function useSerializeProps<P extends object>(
  props: P,
  windowComponent: RemoteComponentName,
  windowParam: string
) {
  const lastSent = React.useRef('')
  const darkMode = useColorScheme() === 'dark'
  const propsStr = JSON.stringify({...props, darkMode})

  const throttledSend = C.useThrottledCallback(
    (nextPropsStr: string) => {
      if (nextPropsStr === lastSent.current) return
      rendererNewProps?.({propsStr: nextPropsStr, windowComponent, windowParam})
      lastSent.current = nextPropsStr
    },
    1000,
    {leading: true}
  )

  React.useEffect(() => {
    throttledSend(propsStr)
  }, [propsStr, throttledSend])
}
