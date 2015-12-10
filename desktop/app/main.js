// This file is ES5; it's loaded before Babel.
require('babel/register')({
  extensions: ['.desktop.js', '.es6', '.es', '.jsx', '.js']
})

const menubar = require('menubar')
const ipc = require('electron').ipcMain
const BrowserWindow = require('electron').BrowserWindow
const Window = require('./window')
const splash = require('./splash')
const installer = require('./installer')
const app = require('electron').app
const path = require('path')
const showDevTools = require('../../react-native/react/local-debug.desktop').showDevTools
const isDev = require('../../react-native/react/local-debug.desktop').isDev
const shell = require('electron').shell
const helpURL = require('../../react-native/react/constants/urls').helpURL

const appPath = app.getAppPath()
const menubarIconPath = path.resolve(appPath, 'Icon.png')

const mb = menubar({
  index: `file://${__dirname}/../renderer/launcher.html#debug=${isDev}`,
  width: 150, height: 192,
  preloadWindow: true,
  icon: menubarIconPath,
  showDockIcon: true
})

const mainWindow = new Window('index', {
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
  mb.app.on('destroy', () => { mb.tray.destroy() })
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
