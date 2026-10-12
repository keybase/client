// This hook sends props to a remote window. The main process caches the last
// value sent per window, so a window that (re)loads pulls the cached props
// itself and no handshake back to this window is needed.
import * as React from 'react'
import * as C from '@/constants'
import isEqual from 'lodash/isEqual'
import KB2, {type RemotePropsObject} from '@/util/electron'
import {useColorScheme} from 'react-native'
import type {RemoteComponentName} from './remote-component.desktop'

const {rendererNewProps} = KB2.functions

export default function useSerializeProps<P extends RemotePropsObject>(
  props: P,
  windowComponent: RemoteComponentName,
  windowParam: string
) {
  const lastSent = React.useRef<RemotePropsObject | undefined>(undefined)
  const darkMode = useColorScheme() === 'dark'

  const throttledSend = C.useThrottledCallback(
    (nextProps: RemotePropsObject) => {
      if (isEqual(nextProps, lastSent.current)) return
      rendererNewProps?.({props: nextProps, windowComponent, windowParam})
      lastSent.current = nextProps
    },
    1000,
    {leading: true}
  )

  React.useEffect(() => {
    throttledSend({...props, darkMode})
  }, [props, darkMode, throttledSend])
}
