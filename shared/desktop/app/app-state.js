// @flow
// This is modified from https://github.com/mawie81/electron-window-state
import {app, screen, ipcMain} from 'electron'
import fs from 'fs'
import path from 'path'
import {appBundlePath} from './paths'
import isEqual from 'lodash/isEqual'
import {windowStyle} from '../../styles'

export type State = {
  x: ?number,
  y: ?number,
  width: number,
  height: number,
  windowHidden: boolean,
  isMaximized: ?boolean,
  isFullScreen: ?boolean,
  displayBounds: ?any,
  tab: ?string,
  dockHidden: boolean,
  openAtLogin: boolean,
}

export type Config = {
  path: string,
  eventHandlingDelay: number,
}

export type Options = {
  defaultWidth: number,
  defaultHeight: number,
}

export type Managed = {
  winRef: ?any,
  debounceChangeTimer: ?TimeoutID,
  showHandlers: Array<Function>,
  resizeHandlers: Array<Function>,
  moveHandlers: Array<Function>,
  closeHandlers: Array<Function>,
  closedHandlers: Array<Function>,
}

export default class AppState {
  state: State
  config: Config
  managed: Managed

  constructor() {
    this.state = {
      displayBounds: null,
      dockHidden: false,
      height: windowStyle.height,
      isFullScreen: null,
      isMaximized: null,
      openAtLogin: true,
      tab: null,
      width: windowStyle.width,
      windowHidden: false,
      x: null,
      y: null,
    }

    this.config = {
      eventHandlingDelay: 1000,
      path: path.join(app.getPath('userData'), 'app-state.json'),
    }

    this.managed = {
      closeHandlers: [],
      closedHandlers: [],
      debounceChangeTimer: null,
      moveHandlers: [],
      resizeHandlers: [],
      showHandlers: [],
      winRef: null,
    }

    // Listen to the main window asking for this value
    ipcMain.on('getAppState', event => {
      event.sender.send('getAppStateReply', this.state)
    })

    ipcMain.on('setAppState', (event, data) => {
      let openAtLogin = this.state.openAtLogin
      this.state = {
        ...this.state,
        ...data,
      }
      this.saveState({openAtLoginChanged: openAtLogin !== this.state.openAtLogin})
    })

    this._loadStateSync()
    this._loadAppListeners()
  }

  // Changing this to use fs.writeFileSync because:
  //
  // https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback
  // > Note that it is unsafe to use fs.writeFile multiple times on the same file without waiting for the callback.
  //
  // It's hard to reproduce, but I have seen cases where this app-state.json file gets messed up.
  saveState(arg) {
    try {
      let configPath = this.config.path
      let stateToSave = this.state
      fs.writeFileSync(configPath, JSON.stringify(stateToSave))
    } catch (err) {
      console.log(`Error saving file: ${err}`)
    }
    let options = arg || {}

    if (options.openAtLoginChanged) {
      console.log(`Login item settings changed! now ${this.state.openAtLogin ? 'true' : 'false'}`)
      this.setOSLoginState()
    }
  }

  checkOpenAtLogin() {
    console.log('Setting login item due to user pref')

    this.setOSLoginState()
  }

  getDarwinAppName() {
    return __DEV__ ? 'Electron Helper' : 'Keybase'
  }

  setOSLoginState() {
    if (__DEV__) {
      console.log('Skipping auto login state change due to dev env. ')
      return
    }
    // Comment this out if you want to test auto login stuff

    const isDarwin = process.platform === 'darwin'
    const isWindows = process.platform === 'win32'
    // Electron has a bug where app.setLoginItemSettings() to false fails!
    // https://github.com/electron/electron/issues/10880
    if (isDarwin) {
      this.setDarwinLoginState()
    } else if (isWindows) {
      this.setWinLoginState()
    }
  }

  setDarwinLoginState() {
    const applescript = require('applescript')

    try {
      this.checkMultiDarwinLoginItems()
      const appName = this.getDarwinAppName()
      if (this.state.openAtLogin) {
        applescript.execString(
          `tell application "System Events" to get the name of login item "${appName}"`,
          (err, result) => {
            if (!err) {
              // our login item is there, nothing to do
              return
            }
            applescript.execString(
              `tell application "System Events" to make login item at end with properties {path:"${appBundlePath() ||
                ''}", hidden:false, name:"${appName}"}`,
              (err, result) => {
                if (err) {
                  console.log(`apple script error making login item: ${err}, ${result}`)
                }
              }
            )
          }
        )
      } else {
        applescript.execString(
          `tell application "System Events" to delete login item "${appName}"`,
          (err, result) => {
            if (err) {
              console.log(`apple script error removing login item: ${err}, ${result}`)
            }
          }
        )
      }
    } catch (e) {
      console.log('Error setting apple startup prefs: ', e)
    }
  }

  // Remove all our entries but one to repair a previous bug. Can eventually be removed.
  checkMultiDarwinLoginItems() {
    const applescript = require('applescript')
    const appName = this.getDarwinAppName()

    applescript.execString(
      `tell application "System Events" to get the name of every login item`,
      (err, result) => {
        if (err) {
          console.log(`Error getting every login item: ${err}, ${result}`)
          return
        }
        var foundApp = false
        for (var loginItem in result) {
          if (result[loginItem] === appName) {
            if (!foundApp) {
              foundApp = true
              continue
            }
            console.log('login items: deleting ', appName)
            applescript.execString(
              `tell application "System Events" to delete login item "${appName}"`,
              (err, result) => {
                if (err) {
                  console.log(`apple script error deleting multi login items: ${err}, ${result}`)
                }
              }
            )
          }
        }
      }
    )
  }

  setWinLoginState() {
    // Note that setLoginItemSettings uses the registry. We use a .lnk file
    // because it is easier for the installer to remove on uninstall.
    if (!process.env.APPDATA) {
      throw new Error('APPDATA unexpectedly empty')
    }
    const appDataPath = '' + process.env.APPDATA
    const linkpath = path.join(
      appDataPath,
      'Microsoft\\Windows\\Start Menu\\Programs\\Startup\\GUIStartup.lnk'
    )
    if (this.state.openAtLogin) {
      if (!fs.existsSync(linkpath)) {
        var ws = require('windows-shortcuts')
        if (!process.env.APPDATA) {
          throw new Error('APPDATA unexpectedly empty')
        }
        ws.create(linkpath, path.join(appDataPath, 'Keybase\\gui\\Keybase.exe'))
      }
    } else {
      if (fs.existsSync(linkpath)) {
        fs.unlink(linkpath, err => {
          if (err) {
            console.log('An error occurred unlinking the shortcut ' + err.message)
          }
        })
      } else {
        console.log("Keybase.lnk file doesn't exist, cannot delete")
      }
    }
  }

  manageWindow(win: any) {
    // TODO: Do we want to maximize or setFullScreen if the state says we were?
    // if (this.config.maximize && this.state.isMaximized) {
    //   win.maximize()
    // }
    // if (this.config.fullScreen && this.state.isFullScreen) {
    //   win.setFullScreen(true)
    // }

    let showHandler = () => {
      this._showHandler()
    }
    this.managed.showHandlers.push(showHandler)
    win.on('show', showHandler)

    let resizeHandler = () => {
      this._debounceChangeHandler()
    }
    this.managed.resizeHandlers.push(resizeHandler)
    win.on('resize', resizeHandler)

    let moveHandler = () => {
      this._debounceChangeHandler()
    }
    this.managed.moveHandlers.push(moveHandler)
    win.on('move', moveHandler)

    let closeHandler = () => {
      this._closeHandler()
    }
    this.managed.closeHandlers.push(closeHandler)
    win.on('close', closeHandler)

    let closedHandler = () => {
      this._closedHandler()
    }
    this.managed.closedHandlers.push(closedHandler)
    win.on('closed', closedHandler)

    this.managed.winRef = win
  }

  _clearWindow() {
    let winRef = this.managed.winRef
    if (winRef) {
      for (let showHandler of this.managed.showHandlers) {
        winRef.removeListener('show', showHandler)
      }
      this.managed.showHandlers = []
      for (let resizeHandler of this.managed.resizeHandlers) {
        winRef.removeListener('resize', resizeHandler)
      }
      this.managed.resizeHandlers = []
      for (let moveHandler of this.managed.moveHandlers) {
        winRef.removeListener('move', moveHandler)
      }
      this.managed.moveHandlers = []
      for (let closeHandler of this.managed.closeHandlers) {
        winRef.removeListener('close', closeHandler)
      }
      this.managed.closeHandlers = []
      for (let closedHandler of this.managed.closedHandlers) {
        winRef.removeListener('closed', closedHandler)
      }
      this.managed.closedHandlers = []
      this.managed.winRef = null
    }
    this.managed.debounceChangeTimer && clearTimeout(this.managed.debounceChangeTimer)
  }

  _isValidWindowState(state: State): boolean {
    // Check if the display where the window was last open is still available
    let rect = {
      height: state.height,
      width: state.width,
      x: state.x || 0,
      y: state.y || 0,
    }
    let displayBounds = screen.getDisplayMatching(rect).bounds
    console.log('Check bounds:', rect, state.displayBounds, displayBounds)
    return isEqual(state.displayBounds, displayBounds)
  }

  _loadStateSync() {
    let configPath = this.config.path
    try {
      fs.accessSync(configPath, fs.F_OK)
    } catch (e) {
      console.log('No app state')
      return
    }
    try {
      const stateLoaded = JSON.parse(fs.readFileSync(configPath, {encoding: 'utf8'}))

      if (!this._isValidWindowState(stateLoaded)) {
        stateLoaded.x = null
        stateLoaded.y = null
      }

      if (!stateLoaded.hasOwnProperty('openAtLogin')) {
        // always make sure we have, this
        stateLoaded.openAtLogin = true
      }

      this.state = stateLoaded
    } catch (e) {
      console.warn('Error loading app state:', e)
    }
  }

  _isNormal(win: any): boolean {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen()
  }

  _updateState() {
    let winRef = this.managed.winRef
    if (winRef) {
      let winBounds = winRef.getBounds()
      if (this._isNormal(this.managed.winRef)) {
        this.state.x = winBounds.x
        this.state.y = winBounds.y
        this.state.width = winBounds.width
        this.state.height = winBounds.height
      }
      this.state.isMaximized = winRef.isMaximized()
      this.state.isFullScreen = winRef.isFullScreen()
      this.state.displayBounds = screen.getDisplayMatching(winBounds).bounds
      this.state.windowHidden = !winRef.isVisible()
    }
    this.saveState()
  }

  _showHandler() {
    this._updateState()
  }

  _closeHandler() {
    this._updateState()
  }

  _closedHandler() {
    this._clearWindow()
  }

  _debounceChangeHandler() {
    this.managed.debounceChangeTimer && clearTimeout(this.managed.debounceChangeTimer)
    this.managed.debounceChangeTimer = setTimeout(() => {
      this._updateState()
    }, this.config.eventHandlingDelay)
  }

  _loadAppListeners() {
    app.on('-keybase-dock-showing', () => {
      this.state.dockHidden = false
      this.saveState()
    })

    app.on('-keybase-dock-hide', () => {
      this.state.dockHidden = true
      this.saveState()
    })
  }
}
