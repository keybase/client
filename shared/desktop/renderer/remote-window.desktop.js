// @flow
// This HOC wraps a component that represents a remote window. When this component is mounted anywhere it'll make a BrowserWindow
import * as React from 'react'
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

const devScripts = __DEV__
  ? [
      {
        async: false,
        src: resolveRootAsURL('dist', 'dll/dll.vendor.js'),
      },
      {
        async: false,
        src: hotPath('common-chunks.js'),
      },
    ]
  : []

type Props = {
  windowOpts?: Object,
  positionBottomRight?: boolean,
  component: string,
  title: string,
}

const defaultWindowOpts = {
  frame: false,
  fullscreen: false,
  height: 300,
  resizable: false,
  show: true,
  width: 500,
}

type State = {
  remoteWindow: ?BrowserWindow,
}

export default function RemoteWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props, State> {
    remoteWindow: ?BrowserWindow
    remoteWindowId: string

    state = {
      remoteWindow: null,
    }

    _makeRemoteWindow = () => {
      const windowOpts = {
        ...defaultWindowOpts,
        ...this.props.windowOpts,
      }
      this.remoteWindow = new BrowserWindow(windowOpts)
      this.setState({remoteWindow: this.remoteWindow})
      if (this.props.positionBottomRight && electron.screen.getPrimaryDisplay()) {
        const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
        this.remoteWindow.setPosition(width - windowOpts.width - 100, height - windowOpts.height - 100, false)
      }
    }

    _bookkeepWindowID = () => {
      // Keep remoteWindowId since remoteWindow properties are not accessible if destroyed
      this.remoteWindowId = this.remoteWindow.id
      remoteIdsToComponents[this.remoteWindowId] = this
    }

    _setupWebContents = () => {
      const webContents = this.remoteWindow.webContents
      webContents.on('did-finish-load', () => {
        webContents.send('load', {
          selectorParams: this.props.selectorParams,
          component: this.props.component,
          scripts: [
            ...devScripts,
            {
              async: false,
              src: hotPath('remote-component-loader2.bundle.js'),
            },
          ],
          title: this.props.title,
        })
      })

      if (showDevTools && !skipSecondaryDevtools) {
        webContents.openDevTools('detach')
      }
    }

    componentWillMount() {
      this._makeRemoteWindow()
      this._bookkeepWindowID()

      menuHelper(this.remoteWindow)

      ipcRenderer.send('showDockIconForRemoteWindow', this.remoteWindowId)
      ipcRenderer.send('listenForRemoteWindowClosed', this.remoteWindowId)

      this.remoteWindow.loadURL(
        resolveRootAsURL('renderer', injectReactQueryParams(`renderer.html?${this.props.component || ''}`))
      )

      this._setupWebContents()
    }

    componentWillUnmount() {
      if (this.remoteWindowId) {
        delete remoteIdsToComponents[this.remoteWindowId]
      }

      ipcRenderer.send('remoteUnmount', this.remoteWindowId)
    }

    render() {
      const {windowOpts, positionBottomRight, title, ...props} = this.props
      return <ComposedComponent {...props} remoteWindow={this.state.remoteWindow} />
    }
  }

  return RemoteWindowComponent
}
