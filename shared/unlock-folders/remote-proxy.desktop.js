// @flow
import * as React from 'react'
import RemoteConnector from '../desktop/remote/connector.desktop'
import RemoteWindow from '../desktop/remote/window.desktop'
import {connect, type TypedState, compose} from '../util/container'

const PrintDebug = props => <div style={{wordWrap: 'break-word'}}>{JSON.stringify(props)}</div>

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

const UnlockFolder = compose(
  connect(unlockFolderMapPropsToState, () => ({}), mergeProps),
  RemoteWindow,
  RemoteConnector
)(PrintDebug)

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
