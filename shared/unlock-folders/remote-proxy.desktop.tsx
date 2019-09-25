import * as React from 'react'
import * as Styles from '../styles'
import * as Constants from '../constants/config'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {NullComponent, connect, compose} from '../util/container'
import {serialize} from './remote-serializer.desktop'

type OwnProps = {}

const windowOpts = {height: 300, width: 500}

// Actions are handled by remote-container
const UnlockFolder = compose(
  connect(
    state => {
      const {devices, phase, paperkeyError, waiting} = state.unlockFolders
      return {
        darkMode: Styles.isDarkMode(),
        devices,
        paperkeyError,
        phase,
        remoteWindowNeedsProps: Constants.getRemoteWindowPropsCount(state.config, 'unlockFolders', ''),
        waiting,
        windowComponent: 'unlock-folders',
        windowOpts,
        windowParam: '',
        windowTitle: 'UnlockFolders',
      }
    },
    () => ({}),
    (stateProps, _, __) => ({
      darkMode: stateProps.darkMode,
      devices: stateProps.devices.toJS(), // Never send immutable over the wire
      paperkeyError: stateProps.paperkeyError,
      phase: stateProps.phase,
      remoteWindowNeedsProps: stateProps.remoteWindowNeedsProps,
      waiting: stateProps.waiting,
      windowComponent: stateProps.windowComponent,
      windowOpts: stateProps.windowOpts,
      windowParam: stateProps.windowParam,
      windowPositionBottomRight: false,
      windowTitle: stateProps.windowTitle,
    })
  ),
  SyncBrowserWindow,
  SyncProps(serialize)
)(NullComponent)

type Props = {
  show: boolean
}

class UnlockFolders extends React.PureComponent<Props> {
  render() {
    // return this.props.show ? <UnlockFolder /> : null
    // TEMP
    return <UnlockFolder />
  }
}

export default connect(
  state => ({show: state.unlockFolders.popupOpen}),
  () => ({}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(UnlockFolders)
