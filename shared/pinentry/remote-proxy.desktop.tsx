// Manages remote pinentry windows
import * as Constants from '../constants/pinentry'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as DarkMode from '../constants/darkmode'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize, type ProxyProps} from './remote-serializer.desktop'
import shallowEqual from 'shallowequal'

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
  const {cancelLabel, prompt, retryLabel, showTyping, submitLabel, type, windowTitle} = Constants.useState(
    s => {
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
    },
    shallowEqual
  )
  const show = type !== RPCTypes.PassphraseType.none && !!showTyping
  const darkMode = DarkMode.useDarkModeState(s => s.isDarkMode())
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
