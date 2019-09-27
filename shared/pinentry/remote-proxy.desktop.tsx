// A mirror of the remote pinentry windows.
// RemotePinentrys renders all of them (usually only one)
// RemotePinentry is a single remote window
import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../styles'
import * as Types from '../constants/types/pinentry'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {NullComponent, connect, mapProps, compose} from '../util/container'
import {serialize} from './remote-serializer.desktop'

const dataToProps = mapProps(
  ({
    data,
    remoteWindowNeedsProps,
    darkMode,
  }: {
    darkMode: boolean
    data: Types.PinentryState
    remoteWindowNeedsProps: number
  }) => ({
    cancelLabel: data.cancelLabel,
    darkMode,
    prompt: data.prompt,
    remoteWindowNeedsProps,
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
  })
)

// Actions are handled by remote-container
const RemotePinentry = compose(
  dataToProps,
  SyncBrowserWindow,
  SyncProps(serialize)
)(NullComponent)

type Props = {
  darkMode: boolean
  remoteWindowNeedsProps?: Map<string, number>
  sessionIDToPinentry: I.Map<number, Types.PinentryState>
}

class RemotePinentrys extends React.PureComponent<Props> {
  render() {
    return this.props.sessionIDToPinentry.keySeq().reduce((arr, id) => {
      const data = this.props.sessionIDToPinentry.get(id)
      const remoteWindowNeedsProps =
        (this.props.remoteWindowNeedsProps && this.props.remoteWindowNeedsProps.get(String(id))) || -1
      if (data) {
        arr.push(
          // @ts-ignore
          <RemotePinentry
            key={String(id)}
            data={data}
            remoteWindowNeedsProps={remoteWindowNeedsProps}
            darkMode={this.props.darkMode}
          />
        )
      }
      return arr
    }, [])
  }
}

type OwnProps = {}

export default connect(
  state => ({
    darkMode: Styles.isDarkMode(),
    remoteWindowNeedsProps: state.config.remoteWindowNeedsProps.get('pinentry'),
    sessionIDToPinentry: state.pinentry.sessionIDToPinentry,
  }),
  () => ({}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(RemotePinentrys)
