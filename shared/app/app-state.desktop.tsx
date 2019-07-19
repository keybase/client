// This is modified from https://github.com/mawie81/electron-window-state
import * as SafeElectron from '../util/safe-electron.desktop'
import fs from 'fs'
import path from 'path'
import {isEqual} from 'lodash-es'
import logger from '../logger'
import {State} from './app-state'

export type Config = {
  path: string
  eventHandlingDelay: number
}

export type Options = {
  defaultWidth: number
  defaultHeight: number
}

export type Managed = {
  winRef: any | null
  debounceChangeTimer?: NodeJS.Timer
  showHandlers: Array<Function>
  resizeHandlers: Array<Function>
  moveHandlers: Array<Function>
  closeHandlers: Array<Function>
  closedHandlers: Array<Function>
}

export default class AppState {
  state: State
  config: Config
  managed: Managed

  constructor() {
    this.state = {
      displayBounds: null,
      dockHidden: false,
      height: 600,
      isFullScreen: null,
      isMaximized: null,
      notifySound: false,
      openAtLogin: true,
      tab: null,
      useNativeFrame: null,
      width: 800,
      windowHidden: false,
      x: null,
      y: null,
    }

    this.config = {
      eventHandlingDelay: 1000,
      path: path.join(SafeElectron.getApp().getPath('userData'), 'app-state.json'),
    }

    this.managed = {
      closeHandlers: [],
      closedHandlers: [],
      debounceChangeTimer: undefined,
      moveHandlers: [],
      resizeHandlers: [],
      showHandlers: [],
      winRef: null,
    }

    // Listen to the main window asking for this value
    SafeElectron.getIpcMain().on('getAppState', event => {
      event.sender.send('getAppStateReply', this.state)
    })

    SafeElectron.getIpcMain().on('setAppState', (_, data) => {
      this.state = {
        ...this.state,
        ...data,
      }
      this.saveState()
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
  saveState() {
    try {
      let configPath = this.config.path
      let stateToSave = this.state
      fs.writeFileSync(configPath, JSON.stringify(stateToSave))
    } catch (err) {
      logger.info(`Error saving file: ${err}`)
    }

    if (SafeElectron.getApp().getLoginItemSettings().openAtLogin !== this.state.openAtLogin) {
      logger.info(`Login item settings changed! now ${this.state.openAtLogin ? 'true' : 'false'}`)
      this.setOSLoginState()
    }
  }

  checkOpenAtLogin() {
    logger.info('Setting login item due to user pref')

    this.setOSLoginState()
  }

  setOSLoginState() {
    if (__DEV__) {
      logger.info('Skipping auto login state change due to dev env. ')
      return
    }

    if (process.platform === 'darwin' || process.platform === 'win32') {
      logger.info('Setting login item state', this.state.openAtLogin)
      SafeElectron.getApp().setLoginItemSettings({openAtLogin: !!this.state.openAtLogin})
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
    // and sanity check that we're placing the window where it will overlap
    // the current screen, as per
    // https://github.com/electron/electron/issues/10862
    let rect = {
      height: state.height,
      width: state.width,
      x: state.x || 0,
      y: state.y || 0,
    }
    let displayBounds = SafeElectron.getScreen().getDisplayMatching(rect).bounds
    logger.info('Check bounds:', rect, state.displayBounds, displayBounds)
    return (
      isEqual(state.displayBounds, displayBounds) &&
      !(
        rect.x > displayBounds.x + displayBounds.width ||
        rect.x + rect.width < displayBounds.x ||
        rect.y > displayBounds.y + displayBounds.height ||
        rect.y + rect.height < displayBounds.y
      )
    )
  }

  _loadStateSync() {
    let configPath = this.config.path
    try {
      // @ts-ignore codemod issue
      fs.accessSync(configPath, fs.F_OK)
    } catch (e) {
      logger.info('No app state')
      return
    }
    try {
      const stateLoaded = JSON.parse(fs.readFileSync(configPath, {encoding: 'utf8'}))

      if (!this._isValidWindowState(stateLoaded)) {
        logger.info('  -- invalid window state')
        stateLoaded.x = null
        stateLoaded.y = null
      }

      if (!Object.prototype.hasOwnProperty.call(stateLoaded, 'openAtLogin')) {
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
      this.state.displayBounds = SafeElectron.getScreen().getDisplayMatching(winBounds).bounds
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
    this.saveState()
  }

  _debounceChangeHandler() {
    this.managed.debounceChangeTimer && clearTimeout(this.managed.debounceChangeTimer)
    this.managed.debounceChangeTimer = setTimeout(() => {
      this._updateState()
    }, this.config.eventHandlingDelay)
  }

  _loadAppListeners() {
    // @ts-ignore
    SafeElectron.getApp().on('-keybase-dock-showing', () => {
      this.state.dockHidden = false
      this.saveState()
    })

    // @ts-ignore
    SafeElectron.getApp().on('-keybase-dock-hide', () => {
      this.state.dockHidden = true
      this.saveState()
    })
  }
}
