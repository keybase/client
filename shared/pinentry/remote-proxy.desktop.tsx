// Manages remote pinentry windows
import * as React from 'react'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Styles from '../styles'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import * as Container from '../util/container'
import * as Types from '../constants/types/pinentry'
import {serialize} from './remote-serializer.desktop'

export type WireProps = {
  darkMode: boolean
} & Types.State

const windowOpts = {height: 210, width: 440}

const Pinentry = (p: WireProps & {forceUpdate: number}) => {
  console.log('aaa pinetry rendereing', p)
  const windowComponent = 'pinentry'
  const windowParam = 'pinentry'

  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowParam,
    windowTitle: 'Pinentry',
  })

  const {forceUpdate, ...toSend} = p
  useSerializeProps(toSend, serialize, forceUpdate, windowComponent, windowParam)
  return null
}

const PinentryMemo = React.memo(Pinentry)

const PinentryProxy = () => {
  const state = Container.useSelector(s => s)
  const {showTyping, type} = state.pinentry
  const show = type !== RPCTypes.PassphraseType.none && !!showTyping
  if (show) {
    const forceUpdate = state.config.remoteWindowNeedsProps.get('pinentry')?.get('pinentry') ?? 0
    const {cancelLabel, prompt, retryLabel, showTyping, submitLabel, type, windowTitle} = state.pinentry
    return (
      <PinentryMemo
        cancelLabel={cancelLabel}
        darkMode={Styles.isDarkMode()}
        forceUpdate={forceUpdate}
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
