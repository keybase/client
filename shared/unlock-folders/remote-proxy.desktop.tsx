import * as Styles from '../styles'
import * as Constants from '../constants/config'
import SyncProps from '../desktop/remote/sync-props.desktop'
import useBrowserWindow from '../desktop/remote/use-browser-window.desktop'
import * as Container from '../util/container'
import {serialize} from './remote-serializer.desktop'

const windowOpts = {height: 300, width: 500}

type State = Container.TypedState['unlockFolders']

export type WireProps = {
  darkMode: boolean
  devices: State['devices']
  paperkeyError: State['paperkeyError']
  phase: State['phase']
  remoteWindowNeedsProps: number
  waiting: State['waiting']
}

const UnlockFolder: any = SyncProps(serialize)(Container.NullComponent)

export default () => {
  const state = Container.useSelector(s => s)
  const {devices, phase, paperkeyError, waiting, popupOpen} = state.unlockFolders
  const props = {
    darkMode: Styles.isDarkMode(),
    devices,
    paperkeyError,
    phase,
    remoteWindowNeedsProps: Constants.getRemoteWindowPropsCount(state.config, 'unlockFolders', ''),
    waiting,
  }

  const opts = {
    windowOpts,
    windowTitle: 'UnlockFolders',
    windowComponent: popupOpen ? 'unlock-folders' : undefined,
  }
  useBrowserWindow(opts)

  return popupOpen ? <UnlockFolder {...props} windowComponent={opts.windowComponent} /> : null
}
