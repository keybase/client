import React, {Component} from 'react'
import {remote, ipcRenderer} from 'electron'
import {resolveRootAsURL} from '../resolve-root'
import menuHelper from '../app/menu-helper'
import hotPath from '../hot-path'
import {screen as electronScreen} from 'electron'
const {BrowserWindow} = remote
const remoteIdsToComponents = {}

// Remember if we close, it's an error to try to close an already closed window
ipcRenderer.on('remoteWindowClosed', (event, remoteWindowId) => {
  if (!remoteIdsToComponents[remoteWindowId]) {
    return
  }

  remoteIdsToComponents[remoteWindowId].onClosed()
  remoteIdsToComponents[remoteWindowId] = null
})

class RemoteComponent extends Component {
  onClosed () {
    if (!this.closed) {
      this.closed = true
      this.props.onRemoteClose && this.props.onRemoteClose()
    }
  }

  componentWillMount () {
    const windowsOpts = {
      width: 500,
      height: 300,
      fullscreen: false,
      show: false,
      resizable: false,
      frame: false,
      ...this.props.windowsOpts}

    this.remoteWindow = new BrowserWindow(windowsOpts)

    if (this.props.positionBottomRight && electronScreen.getPrimaryDisplay()) {
      const {width, height} = electronScreen.getPrimaryDisplay().workAreaSize
      this.remoteWindow.setPosition(width - windowsOpts.width - 100, height - windowsOpts.height - 100, false)
    }

    // Keep remoteWindowId since remoteWindow properties are not accessible if destroyed
    this.remoteWindowId = this.remoteWindow.id
    remoteIdsToComponents[this.remoteWindowId] = this

    menuHelper(this.remoteWindow)
    this.closed = false

    this.remoteWindow.on('needProps', () => {
      try {
        this.remoteWindow.emit('hasProps', {...this.props})
      } catch (_) { }
    })

    ipcRenderer.send('showDockIconForRemoteWindow', this.remoteWindowId)
    ipcRenderer.send('listenForRemoteWindowClosed', this.remoteWindowId)

    const componentRequireName = this.props.component
    this.remoteWindow.loadURL(`${resolveRootAsURL('renderer', 'remoteComponent.html')}?component=${componentRequireName || ''}&src=${hotPath('remote-component-loader.bundle.js')}&selectorParams=${this.props.selectorParams}&title=${encodeURI(this.props.title || '')}`)
  }

  componentWillUnmount () {
    remoteIdsToComponents[this.remoteWindowId] = null

    if (!this.closed) {
      this.closed = true
      ipcRenderer.send('remoteUnmount', this.remoteWindowId)
    }
  }

  render () {
    return (<div>{this.props.component}:{this.remoteWindowId}</div>)
  }

  shouldComponentUpdate (nextProps) {
    try {
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
    } catch (_) { }

    // Always return false because this isn't a real component
    return false
  }
}

RemoteComponent.propTypes = {
  component: React.PropTypes.string.isRequired,
  windowsOpts: React.PropTypes.object,
  title: React.PropTypes.string,
  onRemoteClose: React.PropTypes.func,
  hidden: React.PropTypes.bool, // Hide the remote window (Does not close the window)
  selectorParams: React.PropTypes.string, // To get a substore
  ignoreNewProps: React.PropTypes.bool, // Do not send the remote window new props. Sometimes the remote component will have it's own store and can get it's own data. It doesn't need us to send it.
}

export default RemoteComponent
