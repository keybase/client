// @flow
// A mirror of the remote pinentry windows.
// RemotePinentrys renders all of them (usually only one)
// RemotePinentry is a single remote window
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/pinentry'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {NullComponent, connect, mapProps, type TypedState, compose} from '../util/container'

const dataToProps = mapProps(({data}: {data: Types.PinentryState}) => ({
  cancelLabel: data.cancelLabel,
  prompt: data.prompt,
  retryLabel: data.retryLabel,
  sessionID: data.sessionID,
  showTyping: data.showTyping,
  submitLabel: data.submitLabel,
  submitted: data.submitted,
  type: data.type,
  windowComponent: 'pinentry',
  windowOpts: {height: 210, width: 440},
  windowParam: String(data.sessionID),
  windowPositionBottomRight: false,
  windowTitle: 'Pinentry',
}))

// Actions are handled by remote-container
const RemotePinentry = compose(dataToProps, SyncBrowserWindow, SyncProps)(NullComponent)

type Props = {
  sessionIDToPinentry: I.Map<number, Types.PinentryState>,
}

class RemotePinentrys extends React.PureComponent<Props> {
  render() {
    return this.props.sessionIDToPinentry.keySeq().reduce((arr, id) => {
      const data = this.props.sessionIDToPinentry.get(id)
      if (data) {
        arr.push(<RemotePinentry key={String(id)} data={data} />)
      }
      return arr
    }, [])
  }
}

const mapStateToProps = (state: TypedState) => ({
  sessionIDToPinentry: state.pinentry.sessionIDToPinentry,
})

export default connect(mapStateToProps, () => ({}))(RemotePinentrys)
