// @flow
import hotPath from '../hot-path'
import menubar from 'menubar'
import {ipcMain, systemPreferences} from 'electron'
import {resolveImage, resolveRootAsURL} from '../resolve-root'
import {showDevTools, skipSecondaryDevtools} from '../shared/local-debug.desktop'

import type {BadgeType} from '../shared/constants/notifications'

let iconType: BadgeType = 'regular'

const isMacOS = process.platform === 'darwin'

const isDarkMode = () => isMacOS && systemPreferences && systemPreferences.isDarkMode()

const getIcon = (invertColors) => {
  const devMode = __DEV__ ? '-dev' : ''
  let color = 'white'
  let platform = ''

  if (isMacOS) {
    color = isDarkMode() ? 'white' : 'black'
  } else if (process.platform === 'win32') {
    color = 'black'
    platform = 'windows-'
  }

  color = invertColors ? ({black: 'white', white: 'black'})[color] : color

  return resolveImage('menubarIcon', `icon-${platform}keybase-dog-${iconType}-${color}-22${devMode}@2x.png`)
}

export default function () {
  const mb = menubar({
    index: resolveRootAsURL('renderer', 'renderer.html?menubar'),
    width: 320,
    height: 350,
    frame: false,
    resizable: false,
    preloadWindow: true,
    icon: getIcon(false),
    // Without this flag set, menubar will hide the dock icon when the app
    // ready event fires. We manage the dock icon ourselves, so this flag
    // prevents menubar from changing the state.
    showDockIcon: true,
  })

  const updateIcon = (invertColors) => {
    mb.tray.setImage(getIcon(invertColors))
  }

  if (isMacOS && systemPreferences && systemPreferences.subscribeNotification) {
    systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
      updateIcon(false)
    })
  }

  ipcMain.on('showTray', (event, type) => {
    iconType = type
    updateIcon(false)
  })

  // We keep the listeners so we can cleanup on hot-reload
  const menubarListeners = []

  ipcMain.on('unsubscribeMenubar', event => {
    const index = menubarListeners.indexOf(event.sender)
    if (index !== -1) {
      menubarListeners.splice(index, 1)
    }
  })

  ipcMain.on('subscribeMenubar', event => {
    menubarListeners.push(event.sender)
  })

  ipcMain.on('closeMenubar', () => {
    mb.hideWindow()
  })

  mb.on('ready', () => {
    // Hack: open widget when left/right/double clicked
    mb.tray.on('right-click', (e, bounds) => {
      e.preventDefault()
      setImmediate(() => mb.tray.emit('click', {...e}, {...bounds}))
    })
    mb.tray.on('double-click', e => e.preventDefault())

    const webContents = mb.window.webContents
    webContents.on('did-finish-load', () => {
      webContents.send('load', {
        scripts: [
          ...(__DEV__ ? [resolveRootAsURL('dist', 'dll/dll.vendor.js')] : []),
          ...[hotPath('launcher.bundle.js')]],
        selectorParams: 'menubar',
      })
    })

    if (showDevTools && !skipSecondaryDevtools) {
      webContents.openDevTools('detach')
    }

    // prevent the menubar's window from dying when we quit
    // We remove any existing listeners to close because menubar has one that deletes the reference to mb.window
    mb.window.removeAllListeners('close')
    mb.window.on('close', event => {
      event.preventDefault()
      mb.hideWindow()
    })

    if (process.platform === 'linux') {
      mb.tray.setToolTip('Show Keybase')
    }

    mb.on('show', () => {
      menubarListeners.forEach(l => l.send('menubarShow'))
      isMacOS && updateIcon(!isDarkMode())
    })
    mb.on('hide', () => {
      menubarListeners.forEach(l => l.send('menubarHide'))
      isMacOS && updateIcon(false)
    })
  })

  // Work around an OS X bug that leaves a gap in the status bar if you exit
  // without removing your status bar icon.
  if (isMacOS) {
    mb.app.on('before-quit', () => {
      mb.tray && mb.tray.destroy()
    })
  }
}
