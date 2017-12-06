// @flow
// This HOC wraps a RemoteWindow so it can send props over the wire
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
// If asked we'll send all props, otherwise we do a shallow compare and send the different ones
import * as React from 'react'
import electron, {remote} from 'electron'

const ipcRenderer = electron.ipcRenderer
const BrowserWindow = remote.BrowserWindow

type Props = {
  windowParam: ?string,
  windowComponent: string,
  remoteWindow: ?BrowserWindow,
}

function SyncProps(ComposedComponent: any) {
  class RemoteConnected extends React.PureComponent<Props> {
    _lastProps: Object = {}

    _sendProps = () => {
      if (this.props.remoteWindow) {
        try {
          const props = this._getPropsToSend()
          this.props.remoteWindow && this.props.remoteWindow.emit('props', props)
        } catch (e) {
          console.error(e)
        }
      }
    }

    _onNeedProps = ({sender}, windowComponent: string, windowParam: string) => {
      if (windowComponent === this.props.windowComponent && windowParam === this.props.windowParam) {
        // If the remote asks for props send the whole thing
        this._lastProps = {}
        this._sendProps()
      }
    }

    _getPropsToSend = () => {
      const childProps = this._getChildProps()
      const toSend = Object.keys(childProps).reduce((map, key) => {
        if (childProps[key] !== this._lastProps[key]) {
          map[key] = childProps[key]
        }
        return map
      }, {})
      this._lastProps = childProps
      return toSend
    }

    _getChildProps = () => {
      // Don't pass down remoteWindow
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
      return <ComposedComponent {...this._getChildProps()} />
    }
  }

  return RemoteConnected
}

export default SyncProps
