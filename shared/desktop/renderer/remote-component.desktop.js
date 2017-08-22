// @flow
import React, {Component} from 'react'
import electron from 'electron'
import hotPath from '../hot-path'
import menuHelper from '../app/menu-helper'
import {injectReactQueryParams} from '../../util/dev'
import {resolveRootAsURL} from '../resolve-root'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug.desktop'

const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow
const ipcRenderer = electron.ipcRenderer

const remoteIdsToComponents = {}

// Remember if we close, it's an error to try to close an already closed window
if (ipcRenderer) {
  ipcRenderer.on('remoteWindowClosed', (event, remoteWindowId) => {
    if (!remoteIdsToComponents[remoteWindowId]) {
      return
    }

    remoteIdsToComponents[remoteWindowId].onClosed()
    remoteIdsToComponents[remoteWindowId] = null
  })
}

class RemoteComponent extends Component<any> {
  closed: ?boolean
  remoteWindow: BrowserWindow
  remoteWindowId: string

  onClosed() {
    if (!this.closed) {
      this.closed = true
      this.props.onRemoteClose && this.props.onRemoteClose()
    }
  }

  componentWillMount() {
    const windowsOpts = {
      width: 500,
      height: 300,
      fullscreen: false,
      show: false,
      resizable: false,
      frame: false,
      ...this.props.windowsOpts,
    }

    this.remoteWindow = new BrowserWindow(windowsOpts)

    if (this.props.positionBottomRight && electron.screen.getPrimaryDisplay()) {
      const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
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
      } catch (_) {}
    })

    ipcRenderer.send('showDockIconForRemoteWindow', this.remoteWindowId)
    ipcRenderer.send('listenForRemoteWindowClosed', this.remoteWindowId)

    this.remoteWindow.loadURL(
      resolveRootAsURL('renderer', injectReactQueryParams(`renderer.html?${this.props.component || ''}`))
    )

    const webContents = this.remoteWindow.webContents
    webContents.on('did-finish-load', () => {
      webContents.send('load', {
        scripts: [
          ...(__DEV__
            ? [
                {
                  src: resolveRootAsURL('dist', 'dll/dll.vendor.js'),
                  async: false,
                },
                {
                  src: hotPath('common-chunks.js'),
                  async: false,
                },
              ]
            : []),
          {
            src: hotPath('remote-component-loader.bundle.js'),
            async: false,
          },
        ],
        selectorParams: this.props.selectorParams,
        title: this.props.title,
        component: this.props.component,
      })
    })

    if (showDevTools && !skipSecondaryDevtools) {
      webContents.openDevTools('detach')
    }
  }

  componentWillUnmount() {
    if (this.remoteWindowId) {
      remoteIdsToComponents[this.remoteWindowId] = null
    }

    if (!this.closed) {
      this.closed = true
      ipcRenderer.send('remoteUnmount', this.remoteWindowId)
    }
  }

  render() {
    return <div>{this.props.component}:{this.remoteWindowId}</div>
  }

  shouldComponentUpdate(nextProps: any) {
    if (!this.remoteWindow) {
      return false
    }
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
    } catch (_) {}

    // Always return false because this isn't a real component
    return false
  }
}

export default RemoteComponent
