import BrowserWindow from 'browser-window'
import showDockIcon from './dockIcon'
import {app, ipcMain} from 'electron'

export default class Window {
  constructor (filename, opts) {
    this.filename = filename
    this.opts = opts || {}
    this.window = null
    this.releaseDockIcon = null

    app.on('before-quit', () => {
      this.window && this.window.destroy()
    })

    app.on('ready', () => {
      this.createWindow()
    })

    ipcMain.on('listendForRemoteWindowClosed', (event, remoteWindowId) => {
      BrowserWindow.fromId(remoteWindowId).on('close', () => {
        event.sender.send('remoteWindowClosed', remoteWindowId)
      })
    })
  }

  bindWindowListeners () {
    // We don't really want to close the window since it'll keep track of the main app state.
    // So instead we'll hide it
    this.window.on('close', event => {
      // Prevent an actual close
      event.preventDefault()
      this.window.hide()
      if (this.releaseDockIcon) {
        this.releaseDockIcon()
        this.releaseDockIcon = null
      }
    })

    this.window.on('closed', () => {
      this.window = null
      if (this.releaseDockIcon) {
        this.releaseDockIcon()
        this.releaseDockIcon = null
      }
    })
  }

  createWindow() {
    if (this.window) {
      return
    }

    this.window = new BrowserWindow({show: false, ...this.opts})
    this.window.loadURL(`file://${__dirname}/../renderer/${this.filename}.html`)
    this.bindWindowListeners()
  }

  show (shouldShowDockIcon) {
    if (this.window) {
      if (!this.window.isVisible()) {
        this.window.show()
      }
      if (!this.window.isFocused()) {
        this.window.focus()
      }
      return
    }

    this.createWindow()
    this.releaseDockIcon = shouldShowDockIcon ? showDockIcon() : null

    if (this.opts.openDevTools) {
      this.window.openDevTools()
    }
  }
}
