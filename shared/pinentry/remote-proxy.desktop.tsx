// Manages remote pinentry windows
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as Styles from '../styles'
import * as Types from '../constants/types/pinentry'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import {serialize} from './remote-serializer.desktop'

export type Props = {
  darkMode: boolean
} & Types.State

const windowOpts = {height: 210, width: 440}

const Pinentry = (p: Props) => {
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
  const state = Container.useSelector(s => s)
  const {showTyping, type} = state.pinentry
  const show = type !== RPCTypes.PassphraseType.none && !!showTyping
  if (show) {
    const {cancelLabel, prompt, retryLabel, submitLabel, windowTitle} = state.pinentry
    return (
      <PinentryMemo
        cancelLabel={cancelLabel}
        darkMode={Styles.isDarkMode()}
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
