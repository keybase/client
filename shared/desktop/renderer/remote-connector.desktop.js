// @flow
// This HOC wraps a RemoteWindow so it can send props over the wire
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
import * as React from 'react'
import electron from 'electron'

const ipcRenderer = electron.ipcRenderer
const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow

type Props = {
  selectorParams: ?string,
  component: string,
  remoteWindow: ?BrowserWindow,
}

// export default RemoteComponent
export default function RemoteConnector(ComposedComponent: any) {
  class RemoteConnected extends React.PureComponent<Props> {
    _sendProps = () => {
      if (this.props.remoteWindow) {
        try {
          const props = this._propsToSend()
          console.log('aaa RemoteConnector sending props', JSON.stringify(props, null, 2))
          this.props.remoteWindow.emit('props', props)
        } catch (e) {
          console.error(e)
        }
      }
    }

    _onNeedProps = ({sender}, component: string, selectorParams: ?string) => {
      if (component === this.props.component && selectorParams === this.props.selectorParams) {
        this._sendProps()
      }
    }

    _propsToSend = () => {
      const {remoteWindow, ...props} = this.props
      return props
    }

    componentDidMount() {
      ipcRenderer.on('remoteWindowWantsProps', this._onNeedProps)
    }
    componentWillUnmount() {
      ipcRenderer.removeListener('remoteWindowWantsProps', this._onNeedProps)
    }

    render() {
      this._sendProps()
      return <ComposedComponent {...this._propsToSend()} />
    }
  }

  return RemoteConnected
}
