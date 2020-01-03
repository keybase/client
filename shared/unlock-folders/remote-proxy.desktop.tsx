import * as Styles from '../styles'
import * as Constants from '../constants/config'
import useSerializeProps from '../desktop/remote/use-serialize-props.desktop'
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
  waiting: State['waiting']
}

const UnlockFolders = () => {
  return null
}

export default () => {
  // TODO
  // const state = Container.useSelector(s => s)
  // const {devices, phase, paperkeyError, waiting, popupOpen} = state.unlockFolders
  // const windowComponent = popupOpen ? 'unlock-folders' : undefined
  // useBrowserWindow({
  // windowComponent,
  // windowOpts,
  // windowParam: 'unlockFolders',
  // windowTitle: 'UnlockFolders',
  // })

  // const toSend = {
  // darkMode: Styles.isDarkMode(),
  // devices,
  // paperkeyError,
  // phase,
  // // remoteWindowNeedsProps: Constants.getRemoteWindowPropsCount(state.config, 'unlockFolders', ''),
  // waiting,
  // }
  // useSerializeProps(toSend, serialize, ['unlockFolders', 'unlockFolders'], windowComponent)
  return null
}
