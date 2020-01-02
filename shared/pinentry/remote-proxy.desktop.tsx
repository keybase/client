// A mirror of the remote pinentry windows.
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as Styles from '../styles'
import SyncProps from '../desktop/remote/sync-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import * as Container from '../util/container'
import * as Types from '../constants/types/pinentry'
import {serialize} from './remote-serializer.desktop'

export type WireProps = {
  darkMode: boolean
  showTyping: RPCTypes.Feature
  windowComponent: string
  windowOpts: any
  windowPositionBottomRight: boolean
  windowTitle: string
} & Types.State

// Actions are handled by remote-container
const RemotePinentry: any = SyncProps(serialize)(Container.NullComponent)
const windowOpts = {height: 210, width: 440}

export default () => {
  const state = Container.useSelector(s => s)
  const remoteWindowNeedsProps = state.config.remoteWindowNeedsProps.get('pinentry')
  const pinentry = state.pinentry
  const darkMode = Styles.isDarkMode()

  const show = pinentry.type !== RPCTypes.PassphraseType.none && !!pinentry.showTyping

  const opts = {
    windowComponent: show ? 'pinentry' : undefined,
    windowOpts,
    windowTitle: 'Pinentry',
  }

  useBrowserWindow(opts)

  return show ? (
    <RemotePinentry
      remoteWindowNeedsProps={remoteWindowNeedsProps}
      darkMode={darkMode}
      {...pinentry}
      windowComponent={opts.windowComponent}
    />
  ) : null
}
