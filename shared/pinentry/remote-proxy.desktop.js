// @flow
// A mirror of the remote pinentry windows.
// RemotePinentrys renders all of them (usually only one)
// RemotePinentry is a single remote window
import * as React from 'react'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing} from '../util/container'

const windowOpts = {height: 210, width: 440}

const pinentryMapStateToProps = (state: TypedState, {id}: {id: number}) => {
  const p = state.pinentry.sessionIDToPinentry.get(id)
  if (!p) {
    return {}
  }

  return {
    cancelLabel: p.cancelLabel,
    prompt: p.prompt,
    retryLabel: p.retryLabel,
    sessionID: id,
    showTyping: p.showTyping,
    submitLabel: p.submitLabel,
    submitted: p.submitted,
    type: p.type,
    windowComponent: 'pinentry',
    windowOpts,
    windowParam: String(id),
    windowTitle: 'Pinentry',
  }
}

// Actions are handled by remote-container
const RemotePinentry = compose(
  connect(pinentryMapStateToProps, () => ({})),
  SyncBrowserWindow,
  SyncProps,
  // $FlowIssue gets confused
  renderNothing
)(null)

type Props = {
  pinentryIDs: Array<number>,
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
