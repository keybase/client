import {ipcMain, systemPreferences} from 'electron'
import {resolveImage, resolveRootAsURL} from '../resolve-root'
import hotPath from '../hot-path'
import menubar from 'menubar'

let color = 'white'
let platform = ''

if (process.platform === 'darwin') {
  color = (systemPreferences && systemPreferences.isDarkMode()) ? 'white' : 'black'
} else if (process.platform === 'win32') {
  color = 'black'
  platform = 'windows-'
}

const devMode = __DEV__ ? '-dev' : ''

const icon = resolveImage('menubarIcon', `icon-${platform}keybase-dog-regular-${color}-22${devMode}@2x.png`)
const loadingIcon = resolveImage('menubarIcon', `icon-${platform}keybase-dog-update-${color}-22${devMode}@2x.png`)
const badgedIcon = resolveImage('menubarIcon', `icon-${platform}keybase-dog-badged-${color}-22${devMode}@2x.png`)

export default function () {
  const mb = menubar({
    index: `${resolveRootAsURL('renderer', 'launcher.html')}?src=${hotPath('launcher.bundle.js')}&selectorParams=menubar`,
    width: 320,
    height: 350,
    frame: false,
    resizable: false,
    preloadWindow: true,
    icon: icon,
    showDockIcon: true, // This causes menubar to not touch dock icon, yeah it's weird
  })

  ipcMain.on('showTrayLoading', () => {
    mb.tray.setImage(loadingIcon)
  })

  ipcMain.on('showTrayRegular', () => {
    mb.tray.setImage(icon)
  })

  ipcMain.on('showTrayBadged', () => {
    mb.tray.setImage(badgedIcon)
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
    // prevent the menubar's window from dying when we quit
    mb.window.on('close', event => {
      mb.window.webContents.on('destroyed', () => {
      })
      mb.hideWindow()
      // Prevent an actual close
      event.preventDefault()
    })

    if (process.platform === 'linux') {
      mb.tray.setToolTip('Show Keybase')
    }

    mb.on('show', () => {
      menubarListeners.forEach(l => l.send('menubarShow'))
    })
    mb.on('hide', () => {
      menubarListeners.forEach(l => l.send('menubarHide'))
    })
  })

  // Work around an OS X bug that leaves a gap in the status bar if you exit
  // without removing your status bar icon.
  if (process.platform === 'darwin') {
    mb.app.on('before-quit', () => {
      mb.tray && mb.tray.destroy()
    })
  }
}
