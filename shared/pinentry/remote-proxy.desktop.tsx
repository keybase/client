// Manages remote pinentry windows
import * as C from '@/constants'
import * as T from '@/constants/types'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {useColorScheme} from 'react-native'
import {usePinentryState} from '@/stores/pinentry'
import type {ProxyProps} from './main2.desktop'

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

  useSerializeProps(p, windowComponent, windowParam)
  return null
}

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
      <Pinentry
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
