import {ipcMain} from 'electron'
import {resolveImage, resolveRootAsURL} from '../resolve-root'
import hotPath from '../hot-path'
import menubar from 'menubar'

const isWhite = ['linux', 'win32'].indexOf(process.platform) !== -1 ? 'white' : 'black'
const icon = resolveImage('menubarIcon', `icon-keybase-dog-regular-${isWhite}-22@2x.png`)
const loadingIcon = resolveImage('menubarIcon', `icon-keybase-dog-update-${isWhite}-22@2x.png`)
const badgedIcon = resolveImage('menubarIcon', `icon-keybase-dog-badged-${isWhite}-22@2x.png`)

export default function () {
  const mb = menubar({
    index: `${resolveRootAsURL('renderer', 'launcher.html')}?src=${hotPath('launcher.bundle.js')}&selectorParams=menubar`,
    width: 320,
    height: 350,
    frame: false,
    resizable: false,
    preloadWindow: true,
    icon: icon,
    showDockIcon: true // This causes menubar to not touch dock icon, yeah it's weird
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
      mb.tray.setToolTip('View Folders')
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
