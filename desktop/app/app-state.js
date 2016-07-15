// @flow
//
//
// This is modified from https://github.com/mawie81/electron-window-state
//

import electron from 'electron'
import fs from 'fs'
import path from 'path'
import jsonfile from 'jsonfile'
import deepEqual from 'deep-equal'
import type {State, Options, Config, Managed} from './app-state'

export default class AppState {
  state: State;
  config: Config;
  managed: Managed;

  constructor (opts: Options) {
    this.state = {
      x: null,
      y: null,
      width: opts.defaultWidth,
      height: opts.defaultHeight,
      windowHidden: false,
      isMaximized: null,
      isFullScreen: null,
      displayBounds: null,
      tab: null,
    }

    this.config = {
      path: path.join(electron.app.getPath('userData'), 'app-state.json'),
      eventHandlingDelay: 100,
    }

    this.managed = {
      debounceChangeTimer: null,
      winRef: null,
      resizeHandlers: [],
      moveHandlers: [],
      closeHandlers: [],
      closedHandlers: [],
    }

    this._loadStateSync()
  }

  saveState () {
    let configPath = this.config.path
    let stateToSave = this.state
    console.log('Saving state:', stateToSave, configPath)
    jsonfile.writeFile(configPath, stateToSave, function (err) {
      if (err) {
        console.log('Error saving file:', err)
      }
    })
  }

  manageWindow (win: any) {
    // TODO: Do we want to maximize or setFullScreen if the state says we were?
    // if (this.config.maximize && this.state.isMaximized) {
    //   win.maximize()
    // }
    // if (this.config.fullScreen && this.state.isFullScreen) {
    //   win.setFullScreen(true)
    // }

    let resizeHandler = () => { this._debounceChangeHandler() }
    this.managed.resizeHandlers.push(resizeHandler)
    win.on('resize', resizeHandler)

    let moveHandler = () => { this._debounceChangeHandler() }
    this.managed.moveHandlers.push(moveHandler)
    win.on('move', moveHandler)

    let closeHandler = () => { this._closeHandler() }
    this.managed.closeHandlers.push(closeHandler)
    win.on('close', closeHandler)

    let closedHandler = () => { this._closedHandler() }
    this.managed.closedHandlers.push(closedHandler)
    win.on('closed', closedHandler)

    this.managed.winRef = win
  }

  clear () {
    let winRef = this.managed.winRef
    if (winRef) {
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
    clearTimeout(this.managed.debounceChangeTimer)
  }

  _isValidState (state: State): boolean {
    // Check if the display where the window was last open is still available
    let rect = {
      x: state.x || 0,
      y: state.y || 0,
      width: state.width,
      height: state.height,
    }
    let displayBounds = electron.screen.getDisplayMatching(rect).bounds
    console.log('Check bounds:', rect, state.displayBounds, displayBounds)
    return deepEqual(state.displayBounds, displayBounds, {strict: true})
  }

  _loadStateSync () {
    let configPath = this.config.path
    try {
      fs.accessSync(configPath, fs.F_OK)
    } catch (e) {
      console.log('No app state')
      return
    }
    try {
      let stateLoaded = jsonfile.readFileSync(configPath)
      if (this._isValidState(stateLoaded)) {
        this.state = stateLoaded
      }
    } catch (e) {
      console.warn('Error loading app state:', e)
    }
  }

  _isNormal (win: any): boolean {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen()
  }

  _updateState () {
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
      this.state.displayBounds = electron.screen.getDisplayMatching(winBounds).bounds
      this.state.windowHidden = !winRef.isVisible()
    }
    this.saveState()
  }

  _closeHandler () {
    this._updateState()
  }

  _closedHandler () {
    this.clear()
  }

  _debounceChangeHandler () {
    clearTimeout(this.managed.debounceChangeTimer)
    this.managed.debounceChangeTimer = setTimeout(() => { this._updateState() }, this.config.eventHandlingDelay)
  }
}
