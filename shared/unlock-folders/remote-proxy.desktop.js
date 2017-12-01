// @flow
import * as React from 'react'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing} from '../util/container'

const windowOpts = {height: 300, width: 500}

const unlockFolderMapPropsToState = (state: TypedState) => {
  const {devices, phase, paperkeyError, waiting} = state.unlockFolders
  return {
    component: 'unlockFolders',
    devices,
    paperkeyError,
    phase,
    selectorParams: '',
    waiting,
    windowOpts,
    windowTitle: 'UnlockFolders',
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  component: stateProps.component,
  devices: stateProps.devices.toJS(), // Never send immutable over the wire
  paperkeyError: stateProps.paperkeyError,
  phase: stateProps.phase,
  selectorParams: stateProps.selectorParams,
  waiting: stateProps.waiting,
  windowOpts: stateProps.windowOpts,
  windowTitle: stateProps.windowTitle,
})

// Actions are handled by remote-container
const UnlockFolder = compose(
  connect(unlockFolderMapPropsToState, () => ({}), mergeProps),
  SyncBrowserWindow,
  SyncProps,
  renderNothing
)(null)

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
