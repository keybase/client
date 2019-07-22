import {showDockIcon, hideDockIcon} from './dock-icon.desktop'
import menuHelper from './menu-helper.desktop'
import * as SafeElectron from '../../util/safe-electron.desktop'

export default class Window {
  filename: string
  opts: any
  window: any
  initiallyVisible: boolean

  constructor(filename: string, opts: any) {
    this.filename = filename
    this.opts = opts || {}
    this.window = null
    this.initiallyVisible = this.opts.show || false
    this.createWindow()

    const ipcMain = SafeElectron.getIpcMain()
    // Listen for remote windows to show a dock icon for, we'll bind them on close to
    // hide the dock icon too
    ipcMain.on('showDockIconForRemoteWindow', () => {
      showDockIcon()
    })

    ipcMain.on('listenForRemoteWindowClosed', (event, remoteWindowId) => {
      const w = SafeElectron.BrowserWindow.fromId(remoteWindowId)
      w &&
        w.on('close', () => {
          try {
            event.sender.send('remoteWindowClosed', remoteWindowId)
          } catch (_) {}
        })
    })

    ipcMain.on('registerRemoteUnmount', (remoteComponentLoaderEvent, remoteWindowId) => {
      const relayRemoteUnmount = (_, otherRemoteWindowId) => {
        if (remoteWindowId === otherRemoteWindowId) {
          remoteComponentLoaderEvent.sender.send('remoteUnmount')
          ipcMain.removeListener('remoteUnmount', relayRemoteUnmount)
        }
      }
      ipcMain.on('remoteUnmount', relayRemoteUnmount)
    })
  }

  bindWindowListeners() {
    // We don't really want to close the window since it'll keep track of the main app state.
    // So instead we'll hide it
    this.window.on('close', event => {
      // Prevent an actual close
      event.preventDefault()
      this.window.hide()
      hideDockIcon()
    })

    this.window.on('closed', () => {
      this.window = null
    })
  }

  createWindow() {
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

  onFirstTimeBeingShown() {
    menuHelper(this.window)
  }

  show() {
    showDockIcon()

    if (this.window) {
      if (!this.window.isVisible()) {
        this.window.show()
      }
      return
    } else {
      this.createWindow()
    }

    if (this.opts.openDevTools) {
      this.window.openDevTools()
    }
  }
}
