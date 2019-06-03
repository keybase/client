// This HOC wraps a component that represents a remote window. When this component is mounted anywhere it'll make a BrowserWindow
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import menuHelper from '../app/menu-helper.desktop'
import {resolveRootAsURL} from '../app/resolve-root.desktop'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug.desktop'

type Props = {
  windowOpts: Object
  windowPositionBottomRight: boolean
  windowComponent: string
  windowTitle: string
  windowParam: string
}

const defaultWindowOpts = {
  frame: false,
  fullscreen: false,
  height: 300,
  resizable: false,
  show: false, // Start hidden and show when we actually get props
  titleBarStyle: 'customButtonsOnHover' as const,
  webPreferences: {
    nodeIntegration: true,
    nodeIntegrationInWorker: false,
  },
  width: 500,
}

type State = {
  remoteWindow: SafeElectron.BrowserWindowType | null
}

function SyncBrowserWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props, State> {
    _remoteWindow: SafeElectron.BrowserWindowType | null = null
    _remoteWindowId: number | null = null
    _mounted: boolean = false

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

    _positionBrowserWindow = (windowOpts: {width: number; height: number}) => {
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
      if (showDevTools && !skipSecondaryDevtools) {
        webContents.openDevTools({mode: 'detach'})
      }
    }

    _onWindowClosed = () => {
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
      this._mounted = true
      const remoteWindow = this._makeBrowserWindow()

      // Keep remoteWindowId since remoteWindow properties are not accessible if destroyed
      this._remoteWindowId = remoteWindow.id

      menuHelper(remoteWindow)

      SafeElectron.getIpcRenderer().send('showDockIconForRemoteWindow', this._remoteWindowId)

      const htmlFile = resolveRootAsURL(
        'dist',
        `${this.props.windowComponent}${__DEV__ ? '.dev' : ''}.html?param=${this.props.windowParam || ''}`
      )
      remoteWindow.loadURL(htmlFile)

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
