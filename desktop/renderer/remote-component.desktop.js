import React, {Component} from '../react/base-react'
import {remote, ipcRenderer} from 'electron'
import resolveAssets from '../resolve-assets'
import menuHelper from '../app/menu-helper'
import hotPath from '../hot-path'
import {globalHacks} from '../react/styles/style-guide'

const {BrowserWindow} = remote

export default class RemoteComponent extends Component {
  componentWillMount () {
    const windowsOpts = {
      width: 500,
      height: 300,
      fullscreen: false,
      show: false,
      resizable: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      ...this.props.windowsOpts}

    windowsOpts.height += globalHacks.framelessWindowDeadzone

    this.remoteWindow = new BrowserWindow(windowsOpts)
    const myRemoteWindowId = this.remoteWindow.id

    menuHelper(this.remoteWindow)
    this.closed = false

    this.remoteWindow.on('needProps', () => {
      if (!this.remoteWindow.isDestroyed()) {
        this.remoteWindow.emit('hasProps', {...this.props})
      }
    })

    ipcRenderer.send('showDockIconForRemoteWindow', this.remoteWindow.id)
    ipcRenderer.send('listenForRemoteWindowClosed', this.remoteWindow.id)

    // Remember if we close, it's an error to try to close an already closed window
    ipcRenderer.on('remoteWindowClosed', (event, remoteWindowId) => {
      if (remoteWindowId === myRemoteWindowId) {
        if (!this.closed) {
          this.closed = true
          this.props.onRemoteClose && this.props.onRemoteClose()
        }
      }
    })

    const componentRequireName = this.props.component
    this.remoteWindow.loadUrl(`file://${resolveAssets('./renderer/remoteComponent.html')}?component=${componentRequireName || ''}&src=${hotPath('remote-component-loader.bundle.js')}`)
  }

  componentWillUnmount () {
    if (!this.closed) {
      this.closed = true
      ipcRenderer.send('remoteUnmount', this.remoteWindow.id)
    }
  }

  render () {
    return (<div>{this.props.component}:{this.remoteWindow.id}</div>)
  }

  shouldComponentUpdate (nextProps) {
    if (!this.remoteWindow.isDestroyed) {
      return false
    }

    if (!this.props.ignoreNewProps && this.props !== nextProps) {
      this.remoteWindow.emit('hasProps', {...this.props})
    }

    if (this.props.hidden !== nextProps.hidden) {
      if (nextProps.hidden) {
        this.remoteWindow.hide()
      } else {
        this.remoteWindow.show()
      }
    }

    // Always return false because this isn't a real component
    return false
  }
}

RemoteComponent.propTypes = {
  component: React.PropTypes.string.isRequired,
  windowsOpts: React.PropTypes.object,
  onRemoteClose: React.PropTypes.func,
  hidden: React.PropTypes.bool, // Hide the remote window (Does not close the window)
  ignoreNewProps: React.PropTypes.bool // Do not send the remote window new props. Sometimes the remote component will have it's own store and can get it's own data. It doesn't need us to send it.
}
