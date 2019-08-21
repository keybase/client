import {showDockIcon, hideDockIcon} from './dock-icon.desktop'
import menuHelper from './menu-helper.desktop'
import * as SafeElectron from '../../util/safe-electron.desktop'

export default class Window {
  filename: string
  opts: any
  window: Electron.BrowserWindow | undefined
  initiallyVisible: boolean

  constructor(filename: string, opts: any) {
    this.filename = filename
    this.opts = opts || {}
    this.initiallyVisible = this.opts.show || false
    this.createWindow()
  }

  bindWindowListeners = () => {
    const w = this.window
    if (!w) {
      return
    }
    // We don't really want to close the window since it'll keep track of the main app state.
    // So instead we'll hide it
    w.on('close', event => {
      // Prevent an actual close
      event.preventDefault()
      w.hide()
      hideDockIcon()
    })

    w.on('closed', () => {
      this.window = undefined
    })
  }

  createWindow = () => {
    if (this.window) {
      return
    }

    if (this.opts.show) {
      showDockIcon()
    }

    this.window = new SafeElectron.BrowserWindow({show: false, ...this.opts})
    this.window.loadURL(this.filename)
    this.bindWindowListeners()
    this.window.once('show', () => this.onFirstTimeBeingShown())
  }

  onFirstTimeBeingShown = () => {
    menuHelper(this.window)
  }

  show = () => {
    showDockIcon()

    const w = this.window

    if (w) {
      !w.isVisible() && w.show()
    } else {
      this.createWindow()
    }
  }
}
