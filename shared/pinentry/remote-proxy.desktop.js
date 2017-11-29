// @flow
// A mirror of the remote pinentry windows.
// RemotePinentrys renders all of them (usually only one)
// RemotePinentry is a single remote window
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/pinentry'
import RemoteConnector from '../desktop/remote/connector.desktop'
import RemoteWindow from '../desktop/remote/window.desktop'
import {connect, type TypedState, compose} from '../util/container'

const PrintDebug = props => <div style={{wordWrap: 'break-word'}}>{JSON.stringify(props)}</div>

const windowOpts = {height: 210, width: 440}

// Actions are handled by pinenetry/remote-container
const pinentryMapStateToProps = (state: TypedState, {id}) => {
  const p = state.pinentry.sessionIDToPinentry.get(id)

  return {
    cancelLabel: p.cancelLabel,
    component: 'pinentry',
    prompt: p.prompt,
    retryLabel: p.retryLabel,
    selectorParams: String(id),
    sessionID: id,
    showTyping: p.showTyping,
    submitLabel: p.submitLabel,
    submitted: p.submitted,
    title: 'Pinentry',
    type: p.type,
    windowOpts,
    windowTitle: p.windowTitle,
  }
}

const RemotePinentry = compose(connect(pinentryMapStateToProps, () => ({})), RemoteWindow, RemoteConnector)(
  PrintDebug
)

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
