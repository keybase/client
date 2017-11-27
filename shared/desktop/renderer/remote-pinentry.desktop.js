// @flow
import * as React from 'react'
import RemoteConnector from './remote-connector'
import RemoteWindow from './remote-window'
import {connect, type TypedState, compose, type Dispatch} from '../../util/container'
// import {onCancel, onSubmit} from '../../actions/pinentry'
import {type PinentryState} from '../../constants/types/pinentry'
import {type GUIEntryFeatures} from '../../constants/types/flow-types'

type Props = {
  registerPinentryListener: () => void,
  onCancel: (sessionID: number) => void,
  onSubmit: (sessionID: number, passphrase: string, features: GUIEntryFeatures) => void,
  pinentryStates: {[key: string]: PinentryState},
}

const windowOpts = {height: 210, width: 440}

// Actions are handled by pinenetry/remote-container
const pinentryMapStateToProps = (state: TypedState, {id}) => {
  const p = state.pinentry.sessionIDToPinentry.get(id)

  return {
    cancelLabel: p.cancelLabel,
    component: 'pinentry',
    features: p.features,
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

class RemotePinentrys extends React.PureComponent<Props> {
  render() {
    return this.props.pinentryIDs.map(id => <RemotePinentry id={id} key={String(id)} />)
  }
}

const mapStateToProps = (state: TypedState) => ({
  pinentryIDs: state.pinentry.sessionIDToPinentry.keySeq().toArray(),
})

const mapDispatchToprops = (dispatch: any, ownProps: {}) => ({
  // onCancel: (sid: number) => dispatch(onCancel(sid)),
  // onSubmit: (sid: number, passphrase: string, features: GUIEntryFeatures) =>
  // dispatch(onSubmit(sid, passphrase, features)),
})

export default connect(mapStateToProps, mapDispatchToprops)(RemotePinentrys)
