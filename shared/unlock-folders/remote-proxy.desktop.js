// @flow
import * as React from 'react'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {NullComponent, connect, type TypedState, compose} from '../util/container'

const windowOpts = {height: 300, width: 500}

const unlockFolderMapPropsToState = (state: TypedState) => {
  const {devices, phase, paperkeyError, waiting} = state.unlockFolders
  return {
    devices,
    paperkeyError,
    phase,
    waiting,
    windowComponent: 'unlockFolders',
    windowOpts,
    windowParam: '',
    windowTitle: 'UnlockFolders',
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  devices: stateProps.devices.toJS(), // Never send immutable over the wire
  paperkeyError: stateProps.paperkeyError,
  phase: stateProps.phase,
  waiting: stateProps.waiting,
  windowComponent: stateProps.windowComponent,
  windowOpts: stateProps.windowOpts,
  windowParam: stateProps.windowParam,
  windowPositionBottomRight: false,
  windowTitle: stateProps.windowTitle,
})

// Actions are handled by remote-container
const UnlockFolder = compose(
  connect(unlockFolderMapPropsToState, () => ({}), mergeProps),
  SyncBrowserWindow,
  SyncProps
)(NullComponent)

type Props = {
  show: boolean,
}
class UnlockFolders extends React.PureComponent<Props> {
  render() {
    return this.props.show ? <UnlockFolder /> : null
  }
}

const mapStateToProps = (state: TypedState) => ({
  show: state.unlockFolders.popupOpen,
})

export default connect(mapStateToProps, () => ({}))(UnlockFolders)
