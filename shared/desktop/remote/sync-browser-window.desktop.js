// @flow
// This HOC wraps a component that represents a remote window. When this component is mounted anywhere it'll make a BrowserWindow
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import hotPath from '../hot-path.desktop'
import menuHelper from '../app/menu-helper.desktop'
import {injectReactQueryParams} from '../../util/dev'
import {resolveRootAsURL} from '../resolve-root.desktop'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug.desktop'

type Props = {
  windowOpts: Object,
  windowPositionBottomRight: boolean,
  windowComponent: string,
  windowTitle: string,
  windowParam: string,
}

const defaultWindowOpts = {
  frame: false,
  fullscreen: false,
  height: 300,
  nodeIntegration: false,
  resizable: false,
  show: false, // Start hidden and show when we actually get props
  width: 500,
}

type State = {
  remoteWindow: ?SafeElectron.BrowserWindowType,
}

const sendLoad = (webContents: any, windowParam: string, windowComponent: string, windowTitle: ?string) => {
  webContents.send('load', {
    scripts: [
      {
        async: false,
        src: hotPath('component-loader.bundle.js'),
      },
    ],
    windowComponent,
    windowParam,
    windowTitle,
  })
}

function SyncBrowserWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props, State> {
    _remoteWindow: ?SafeElectron.BrowserWindowType = null
    _remoteWindowId: ?number = null
    _mounted: boolean = true

    // We only have state to force re-renders and to pass down to the child. We usually want to just use the raw _remoteWindow to avoid races
    state = {
      remoteWindow: null,
    }

    _makeBrowserWindow = (): SafeElectron.BrowserWindowType => {
      const windowOpts = {
        ...defaultWindowOpts,
        ...this.props.windowOpts,
      }
      const w = new SafeElectron.BrowserWindow(windowOpts)
      this._remoteWindow = w
      if (this._mounted) {
        this.setState({remoteWindow: this._remoteWindow})
      }
      this._positionBrowserWindow(windowOpts)
      return w
    }

    _positionBrowserWindow = (windowOpts: {width: number, height: number}) => {
      if (this.props.windowPositionBottomRight && SafeElectron.getScreen().getPrimaryDisplay()) {
        const {width, height} = SafeElectron.getScreen().getPrimaryDisplay().workAreaSize
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
        webContents.openDevTools({mode: 'detach'})
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
        try {
          this._remoteWindow.close()
        } catch (_) {}
        this._remoteWindow = null
      }
    }

    componentDidMount() {
      const remoteWindow = this._makeBrowserWindow()

      // Keep remoteWindowId since remoteWindow properties are not accessible if destroyed
      this._remoteWindowId = remoteWindow.id

      menuHelper(remoteWindow)

      SafeElectron.getIpcRenderer().send('showDockIconForRemoteWindow', this._remoteWindowId)

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

export default SyncBrowserWindow
export {sendLoad}
