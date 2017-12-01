// @flow
// A mirror of the remote pinentry windows.
// RemotePinentrys renders all of them (usually only one)
// RemotePinentry is a single remote window
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/pinentry'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing} from '../util/container'

const windowOpts = {height: 210, width: 440}

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

// Actions are handled by remote-container
const RemotePinentry = compose(
  connect(pinentryMapStateToProps, () => ({})),
  SyncBrowserWindow,
  SyncProps,
  renderNothing
)(null)

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
