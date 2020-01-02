// A mirror of the remote pinentry windows.
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Styles from '../styles'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
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
// const RemotePinentry: any = SyncProps(serialize)(Container.NullComponent)
const windowOpts = {height: 210, width: 440}

export default () => {
  const state = Container.useSelector(s => s)
  const remoteWindowNeedsProps = state.config.remoteWindowNeedsProps.get('pinentry')?.get('pinentry') ?? 0
  const pinentry = state.pinentry
  const darkMode = Styles.isDarkMode()

  const show = pinentry.type !== RPCTypes.PassphraseType.none && !!pinentry.showTyping
  const windowComponent = show ? 'pinentry' : undefined

  useBrowserWindow({
    windowComponent,
    windowOpts,
    windowTitle: 'Pinentry',
  })

  const toSend = {
    ...pinentry,
    darkMode,
    remoteWindowNeedsProps,
  }
  useSerializeProps(toSend, serialize, windowComponent)
  return null
}
