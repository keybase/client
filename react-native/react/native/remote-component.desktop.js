import React, {Component} from '../base-react'
import {showDevTools} from '../local-debug'
import {remote, ipcRenderer} from 'electron'
import resolveAssets from '../../../desktop/resolve-assets'
import hotPath from '../../../desktop/hot-path'

const {BrowserWindow} = remote

export default class RemoteComponent extends Component {
  componentWillMount () {
    const windowsOpts = {width: 500, height: 300, fullscreen: false, show: false, ...this.props.windowsOpts}
    this.remoteWindow = new BrowserWindow(windowsOpts)
    this.closed = false

    if (showDevTools) {
      this.remoteWindow.toggleDevTools()
    }

    this.remoteWindow.on('needProps', () => {
      this.remoteWindow.emit('hasProps', {...this.props})
    })

    ipcRenderer.send('showDockIconForRemoteWindow', this.remoteWindow.id)
    ipcRenderer.send('listenForRemoteWindowClosed', this.remoteWindow.id)

    // Remember if we close, it's an error to try to close an already closed window
    ipcRenderer.on('remoteWindowClosed', (event, remoteWindowId) => {
      if (remoteWindowId === this.remoteWindow.id) {
        if (!this.closed) {
          this.closed = true
          this.props.onRemoteClose && this.props.onRemoteClose()
        }
      }
    })

    const componentRequireName = this.props.component
    const substore = this.props.substore
    this.remoteWindow.loadUrl(`file://${resolveAssets('../react-native/react/native/remoteComponent.html')}?component=${componentRequireName || ''}&substore=${substore || ''}&src=${hotPath('remote-component-loader.bundle.js')}`)
  }

  componentWillUnmount () {
    if (!this.closed) {
      this.closed = true
      ipcRenderer.send('remoteUnmount', this.remoteWindow.id)
    }
  }

  render () {
    return (<div/>)
  }

  shouldComponentUpdate (nextProps) {
    if (this.props !== nextProps && this.remoteWindow) {
      this.remoteWindow.emit('hasProps', {...this.props})
    }
    // Always return false because this isn't a real component
    return false
  }
}

RemoteComponent.propTypes = {
  component: React.PropTypes.string.isRequired,
  substore: React.PropTypes.string,
  windowsOpts: React.PropTypes.object,
  onRemoteClose: React.PropTypes.func
}
