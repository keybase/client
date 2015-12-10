import menubar from 'menubar'
import {ipcMain as ipc, shell} from 'electron'
import Window from './window'
import splash from './splash'
import installer from './installer'
import {app} from 'electron'
import path from 'path'
import {showDevTools} from '../../react-native/react/local-debug.desktop'
import {isDev} from '../../react-native/react/constants/platform'
import {helpURL} from '../../react-native/react/constants/urls'

const appPath = app.getAppPath()
const menubarIconPath = path.resolve('./Icon.png')
const hot = process.env.HOT === 'true'

const mb = menubar({
  index: `file://${path.resolve('./renderer/launcher.html')}?debug=${!!isDev}&hot=${!!hot}`,
  width: 150, height: 192,
  preloadWindow: true,
  icon: menubarIconPath,
  showDockIcon: true
})

const mainWindowURL = path.resolve(`./renderer/index.html?hot=${!!hot}`)

const mainWindow = new Window(mainWindowURL, {
  width: 1600,
  height: 1200,
  openDevTools: true
})

mb.on('after-create-window', () => {
  if (showDevTools) {
    mb.window.openDevTools()
  }
})

mb.on('ready', () => {
  // prevent the menubar's window from dying when we quit
  mb.window.on('close', event => {
    mb.hideWindow()
    // Prevent an actual close
    event.preventDefault()
  })
})

// Work around an OS X bug that leaves a gap in the status bar if you exit
// without removing your status bar icon.
if (process.platform === 'darwin') {
  mb.app.on('destroy', () => {
    mb.tray && mb.tray.destroy() })
}

ipc.on('showMain', () => {
  mainWindow.show(true)
  if (showDevTools && mainWindow.window) {
    mainWindow.window.toggleDevTools()
  }
})

ipc.on('showHelp', () => {
  shell.openExternal(helpURL)
})

installer(err => {
  if (err) {
    console.log('Error: ', err)
  }
  splash()
})

if (app.dock) {
  app.dock.hide()
}

// Don't quit the app, instead try to close all windows
app.on('before-quit', event => {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(w => {
    // We tell it to close, we can register handlers for the 'close' event if we want to
    // keep this window alive or hide it instead.
    w.close()
  })

  event.preventDefault()
})

app.on('destroy', event => {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(w => {
    w.destroy()
  })

  // exit successfully
  app.exit(0)

  // TODO: send some event to the service to tell it to shutdown all the things as well
})

// Simple ipc logging for debugging remote windows

ipc.on('console.log', (event, args) => {
  console.log('From remote console.log')
  console.log.apply(console, args)
})

ipc.on('console.warn', (event, args) => {
  console.log('From remote console.warn')
  console.log.apply(console, args)
})

ipc.on('console.error', (event, args) => {
  console.log('From remote console.error')
  console.log.apply(console, args)
})
