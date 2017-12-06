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
  windowPositionBottomRight?: boolean,
  windowComponent: string,
  windowTitle: string,
  windowParam: string,
}

const defaultWindowOpts = {
  frame: false,
  fullscreen: false,
  height: 300,
  resizable: false,
  show: false, // Start hidden and show when we actually get props
  width: 500,
}

type State = {
  remoteWindow: ?BrowserWindow,
}

const sendLoad = (webContents: any, windowParam: string, windowComponent: string, windowTitle: ?string) => {
  webContents.send('load', {
    windowComponent,
    scripts: [
      ...devScripts,
      {
        async: false,
        src: hotPath('component-loader.bundle.js'),
      },
    ],
    windowParam,
    windowTitle,
  })
}

function BrowserWindowSync(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props, State> {
    _remoteWindow: ?BrowserWindow = null
    _remoteWindowId: ?string = null
    _mounted: boolean = true

    // We only have state to force re-renders and to pass down to the child. We usually want to just use the raw _remoteWindow to avoid races
    state = {
      remoteWindow: null,
    }

    _makeBrowserWindow = (): BrowserWindow => {
      const windowOpts = {
        ...defaultWindowOpts,
        ...this.props.windowOpts,
      }
      this._remoteWindow = new BrowserWindow(windowOpts)
      if (this._mounted) {
        this.setState({remoteWindow: this._remoteWindow})
      }
      this._positionBrowserWindow(windowOpts)
      return this._remoteWindow
    }

    _positionBrowserWindow = (windowOpts: {width: number, height: number}) => {
      if (this.props.windowPositionBottomRight && electron.screen.getPrimaryDisplay()) {
        const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
        this._remoteWindow &&
          this._remoteWindow.setPosition(
            width - windowOpts.width - 100,
            height - windowOpts.height - 100,
            false
          )
      }
    }

    _setupWebContents = () => {
      if (!this._remoteWindow) {
        return
      }
      const webContents = this._remoteWindow.webContents
      webContents.on('did-finish-load', () => {
        sendLoad(webContents, this.props.windowParam, this.props.windowComponent, this.props.windowTitle)
      })

      if (showDevTools && !skipSecondaryDevtools) {
        webContents.openDevTools('detach')
      }
    }

    _onWindowClosed = (id: number) => {
      if (this._mounted) {
        this.setState({remoteWindow: null})
      }

      this._closeBrowserWindow()
    }

    _closeBrowserWindow = () => {
      if (this._remoteWindow) {
        this._remoteWindow.close()
        this._remoteWindow = null
      }
    }

    componentWillMount() {
      const remoteWindow = this._makeBrowserWindow()

      // Keep remoteWindowId since remoteWindow properties are not accessible if destroyed
      this._remoteWindowId = remoteWindow.id

      menuHelper(remoteWindow)

      ipcRenderer.send('showDockIconForRemoteWindow', this._remoteWindowId)

      remoteWindow.loadURL(
        resolveRootAsURL(
          'renderer',
          injectReactQueryParams(`renderer.html?${this.props.windowComponent || ''}`)
        )
      )

      this._setupWebContents()
      remoteWindow.on('close', this._onWindowClosed)
    }

    componentWillUnmount() {
      this._mounted = false
      this._closeBrowserWindow()
    }

    render() {
      // Don't forward our internal props
      const {windowOpts, windowPositionBottomRight, windowTitle, ...props} = this.props
      return <ComposedComponent {...props} remoteWindow={this.state.remoteWindow} />
    }
  }

  return RemoteWindowComponent
}

export default BrowserWindowSync
export {devScripts, sendLoad}
