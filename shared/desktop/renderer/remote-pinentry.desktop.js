// @flow
// A mirror of the remote pinentry windows.
// RemotePinentrys renders all of them (usually only one)
// RemotePinentry is a single remote window
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/pinentry'
import RemoteConnector from './remote-connector.desktop'
import RemoteWindow from './remote-window.desktop'
import {connect, type TypedState, compose, type Dispatch} from '../../util/container'

const windowOpts = {height: 210, width: 440}

// Actions are handled by pinenetry/remote-container
const pinentryMapStateToProps = (state: TypedState, {id}) => {
  const p = state.pinentry.sessionIDToPinentry.get(id)

  return {
    cancelLabel: p.cancelLabel,
    component: 'pinentry',
    showTyping: p.showTyping,
    prompt: p.prompt,
    retryLabel: p.retryLabel,
    selectorParams: String(id),
    sessionID: id,
    submitLabel: p.submitLabel,
    submitted: p.submitted,
    title: 'Pinentry',
    type: p.type,
    windowOpts,
    windowTitle: p.windowTitle,
  }
}
const pinentryMapDispatchToProps = (dispatch: Dispatch, {id}) => ({})

// TODO remoteconnector sends all props over the wire and handles the callbacks
// connect above ha to set some remot eid or osmething
const PrintDebug = props => <div style={{wordWrap: 'break-word'}}>{JSON.stringify(props)}</div>
const RemotePinentry = compose(
  connect(pinentryMapStateToProps, pinentryMapDispatchToProps),
  RemoteWindow,
  RemoteConnector
)(PrintDebug)

type Props = {
  pinentryIDs: I.Map<number, Types.PinentryState>,
}
class RemotePinentrys extends React.PureComponent<Props> {
  render() {
    return this.props.pinentryIDs.map(id => <RemotePinentry id={id} key={String(id)} />)
  }
}

const mapStateToProps = (state: TypedState) => ({
  pinentryIDs: state.pinentry.sessionIDToPinentry.keySeq().toArray(),
})

export default connect(mapStateToProps, () => ({}))(RemotePinentrys)
