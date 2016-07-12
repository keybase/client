//
// This is modified from https://github.com/mawie81/electron-window-state
//

import electron from 'electron'
import fs from 'fs'
import path from 'path'
import jsonfile from 'jsonfile'
import deepEqual from 'deep-equal'

export default class AppState {
  constructor (opts) {
    this.opts = opts || {}
    this.state = {}
    this.eventHandlingDelay = 100

    this.config = Object.assign({
      file: 'app-state.json',
      path: electron.app.getPath('userData'),
    }, this.opts)

    this.winRef = null
    this.stateChangeTimer = null
    this.resizeHandlers = []
    this.moveHandlers = []
    this.closeHandlers = []
    this.closedHandlers = []

    this.loadStateSync()
  }

  get width () {
    return this.state.width
  }

  get height () {
    return this.state.height
  }

  get x () {
    return this.state.x
  }

  get y () {
    return this.state.y
  }

  get windowHidden () {
    return this.state.windowHidden
  }

  loadStateSync () {
    let configPath = this.configPath()
    try {
      fs.accessSync(configPath, fs.F_OK)
    } catch (e) {
      console.log('No app state')
      return
    }
    try {
      let stateLoaded = jsonfile.readFileSync(configPath)
      this.state = stateLoaded
      if (!this.validateState()) {
        this.state = null
      }
      // Set state fallback values
      this.state = Object.assign({
        width: this.config.defaultWidth || 800,
        height: this.config.defaultHeight || 600,
      }, stateLoaded)
    } catch (e) {
      console.warn('Error loading app state:', e)
    }
  }

  setTab (tab) {
    this.state.tab = tab
    this.saveState()
  }

  configPath () {
    return path.join(this.config.path, this.config.file)
  }

  isNormal (win) {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen()
  }

  hasBounds () {
    return this.state &&
      this.state.x !== undefined &&
      this.state.y !== undefined &&
      this.state.width !== undefined &&
      this.state.height !== undefined
  }

  validateState () {
    let isValid = this.state && this.hasBounds()
    if (isValid && this.state.displayBounds) {
      // Check if the display where the window was last open is still available
      let displayBounds = electron.screen.getDisplayMatching(this.state).bounds
      isValid = deepEqual(this.state.displayBounds, displayBounds, {strict: true})
    }
    return isValid
  }

  updateState () {
    let winBounds = this.winRef.getBounds()
    if (this.isNormal(this.winRef)) {
      this.state.x = winBounds.x
      this.state.y = winBounds.y
      this.state.width = winBounds.width
      this.state.height = winBounds.height
    }
    this.state.isMaximized = this.winRef.isMaximized()
    this.state.isFullScreen = this.winRef.isFullScreen()
    this.state.displayBounds = electron.screen.getDisplayMatching(winBounds).bounds
    this.state.windowHidden = !this.winRef.isVisible()
    this.saveState()
  }

  saveState () {
    let configPath = this.configPath()
    let stateToSave = this.state
    console.log('Saving state:', stateToSave, configPath)
    jsonfile.writeFile(configPath, stateToSave, function (err) {
      if (err) {
        console.log('Error saving file:', err)
      }
    })
  }

  closeHandler () {
    this.updateState()
  }

  closedHandler () {
    this.clear()
  }

  debounceChangeHandler () {
    clearTimeout(this.stateChangeTimer)
    this.stateChangeTimer = setTimeout(() => { this.updateState() }, this.eventHandlingDelay)
  }

  manageWindow (win) {
    if (this.config.maximize && this.state.isMaximized) {
      win.maximize()
    }
    if (this.config.fullScreen && this.state.isFullScreen) {
      win.setFullScreen(true)
    }

    let resizeHandler = () => { this.debounceChangeHandler() }
    this.resizeHandlers.push(resizeHandler)
    win.on('resize', resizeHandler)

    let moveHandler = () => { this.debounceChangeHandler() }
    this.moveHandlers.push(moveHandler)
    win.on('move', moveHandler)

    let closeHandler = () => { this.closeHandler() }
    this.closeHandlers.push(closeHandler)
    win.on('close', closeHandler)

    let closedHandler = () => { this.closedHandler() }
    this.closedHandlers.push(closedHandler)
    win.on('closed', closedHandler)

    this.winRef = win
  }

  clear () {
    if (this.winRef) {
      for (let resizeHandler of this.resizeHandlers) {
        this.winRef.removeListener('resize', resizeHandler)
      }
      this.resizeHandlers = []
      for (let moveHandler of this.moveHandlers) {
        this.winRef.removeListener('move', moveHandler)
      }
      this.moveHandlers = []
      for (let closeHandler of this.closeHandlers) {
        this.winRef.removeListener('close', closeHandler)
      }
      this.closeHandlers = []
      for (let closedHandler of this.closedHandlers) {
        this.winRef.removeListener('closed', closedHandler)
      }
      this.closedHandlers = []
      this.winRef = null
    }
    clearTimeout(this.stateChangeTimer)
  }
}
