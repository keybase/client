import {showDockIcon} from './dock-icon'
import menuHelper from './menu-helper'
import {ipcMain, BrowserWindow} from 'electron'
import {focusOnShow} from '../shared/local-debug'

export default class Window {
  constructor (filename, opts) {
    this.filename = filename
    this.opts = opts || {}
    this.window = null
    this.initiallyVisible = this.opts.show || false
    this.createWindow()

    // Listen for remote windows to show a dock icon for, we'll bind the on close to
    // hide the dock icon too
    ipcMain.on('showDockIconForRemoteWindow', (event, remoteWindowId) => {
      showDockIcon()
    })

    ipcMain.on('listenForRemoteWindowClosed', (event, remoteWindowId) => {
      BrowserWindow.fromId(remoteWindowId).on('close', () => {
        try {
          event.sender.send('remoteWindowClosed', remoteWindowId)
        } catch (_) { }
      })
    })

    ipcMain.on('registerRemoteUnmount', (remoteComponentLoaderEvent, remoteWindowId) => {
      const relayRemoteUnmount = (e, otherRemoteWindowId) => {
        if (remoteWindowId === otherRemoteWindowId) {
          remoteComponentLoaderEvent.sender.send('remoteUnmount')
          ipcMain.removeListener('remoteUnmount', relayRemoteUnmount)
        }
      }
      ipcMain.on('remoteUnmount', relayRemoteUnmount)
    })
  }

  bindWindowListeners () {
    // We don't really want to close the window since it'll keep track of the main app state.
    // So instead we'll hide it
    this.window.on('close', event => {
      // Prevent an actual close
      event.preventDefault()
      this.window.hide()
    })

    this.window.on('closed', () => {
      this.window = null
    })
  }

  createWindow () {
    if (this.window) {
      return
    }

    if (this.opts.show) {
      showDockIcon()
    }

    this.window = new BrowserWindow({show: false, ...this.opts})
    this.window.loadURL(`file://${this.filename}`)
    this.bindWindowListeners()
    this.window.once('show', () => this.onFirstTimeBeingShown())
  }

  onFirstTimeBeingShown () {
    menuHelper(this.window)
  }

  show (shouldShowDockIcon) {
    shouldShowDockIcon && showDockIcon()

    if (this.window) {
      if (!this.window.isVisible()) {
        this.window.show()
      }
      if (!this.window.isFocused() && focusOnShow) {
        this.window.focus()
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
