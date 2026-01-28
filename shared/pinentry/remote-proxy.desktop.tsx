// Manages remote pinentry windows
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'
import {useColorScheme} from 'react-native'
import {usePinentryState} from '@/stores/pinentry'

const windowOpts = {height: 230, width: 440}

const Pinentry = (p: ProxyProps) => {
  const windowComponent = 'pinentry'
  const windowParam = 'pinentry'

  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowTitle: 'Pinentry',
  })

  useSerializeProps(p, serialize, windowComponent, windowParam)
  return null
}

const PinentryMemo = React.memo(Pinentry)

const PinentryProxy = () => {
  const {cancelLabel, prompt, retryLabel, showTyping, submitLabel, type, windowTitle} = usePinentryState(
    C.useShallow(s => {
      const {cancelLabel, prompt, retryLabel, showTyping, submitLabel, type, windowTitle} = s
      return {
        cancelLabel,
        prompt,
        retryLabel,
        showTyping,
        submitLabel,
        type,
        windowTitle,
      }
    })
  )
  const show = type !== T.RPCGen.PassphraseType.none && !!showTyping
  const darkMode = useColorScheme() === 'dark'
  if (show) {
    return (
      <PinentryMemo
        cancelLabel={cancelLabel}
        darkMode={darkMode}
        prompt={prompt}
        retryLabel={retryLabel}
        showTyping={showTyping}
        submitLabel={submitLabel}
        type={type}
        windowTitle={windowTitle}
      />
    )
  }
  return null
}

export default PinentryProxy
